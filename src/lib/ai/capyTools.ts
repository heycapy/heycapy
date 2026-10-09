import { recordSystemError } from "@/lib/system-errors";
import { errorMessage } from "@/lib/errors";
import {
  addLocalDays,
  isAllDay,
  localDateString,
  parseLocalDateTime,
  toLocal,
} from "@/lib/reminders/zoned";
import { revalidatePath } from "next/cache";
import { and, eq, gte, isNull, lte, or, sql, notInArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { findBucketByName } from "@/lib/db/buckets";
import { withDefaultChannels } from "@/lib/notifications/channels";
import { initialReminderState, reminderResetForDeadline } from "@/lib/items/reminders";
import {
  refreshBucketReminders,
  refreshItemReminders,
  reminderContext,
} from "@/lib/reminders/refresh";
import { createNextOccurrence } from "@/lib/items/recurrence";
import { toggleItemCompleted } from "@/lib/items/complete";
import { onLastDayIfAnchored, parseRecurring } from "@/lib/items/occurrence";
import { repeatFromArgs } from "./repeatArgs";
import { confirmDelete, nextTurnId } from "./deleteGuard";
import { encryptValue, generateWebhookKey } from "@/lib/crypto";
import {
  BUCKET_NAME_MAX_LENGTH,
  CLOSED_ITEM_STATUSES,
  ITEM_STATUS,
  SETTABLE_ITEM_STATUSES,
  WEEKDAY_SHORT_NAMES,
} from "@/constants";
import { buckets, items } from "@/lib/db/schema";
import { inLiveBucket } from "@/lib/buckets/live";
import { BucketSchema, ReminderOffsets, buildPropertyValidator } from "@/types/rules";
import type { ToolCall } from "./types";

import { ITEM_AND_BUCKET_TOOLS } from "./capyToolDefs";
import { BUCKET_SETTINGS_TOOLS, executeBucketSettingsTool } from "./bucketSettingsTools";

export const CAPY_TOOLS = [...ITEM_AND_BUCKET_TOOLS, ...BUCKET_SETTINGS_TOOLS];

export type UpcomingItem = {
  id: number;
  title: string;
  bucket: string;
  deadlineRelative: string;
  deadline: Date;
};

// Times as the user sees them in the app, e.g. "Thu 2026-10-29 21:00"
function localTime(date: Date, timezone: string): string {
  const l = toLocal(date, timezone);
  const weekday = WEEKDAY_SHORT_NAMES[new Date(Date.UTC(l.year, l.month - 1, l.day)).getUTCDay()];
  const clock = `${String(l.hour).padStart(2, "0")}:${String(l.minute).padStart(2, "0")}`;
  return `${weekday} ${localDateString(date, timezone)} ${clock}`;
}

// A deadline at local midnight has no time: "Fri 2026-10-30, all day"
export function localDeadline(date: Date, timezone: string): string {
  if (!isAllDay(date, timezone)) return localTime(date, timezone);
  return `${localTime(date, timezone).slice(0, -" 00:00".length)}, all day`;
}

function deadlineRelative(deadline: Date, timezone: string): string {
  const now = new Date();
  const todayStr = localDateString(now, timezone);
  const deadlineStr = localDateString(deadline, timezone);

  if (deadlineStr < todayStr) return "overdue";
  if (deadlineStr === todayStr) {
    return !isAllDay(deadline, timezone) && deadline < now ? "overdue today" : "today";
  }

  const tomorrowStr = localDateString(addLocalDays(now, 1, timezone), timezone);
  if (deadlineStr === tomorrowStr) return "tomorrow";

  const diffDays = Math.round((deadline.getTime() - now.getTime()) / 86_400_000);
  if (diffDays <= 7) return `in ${diffDays} days`;
  if (diffDays <= 30) return `in ${Math.round(diffDays / 7)} weeks`;
  return `in ${Math.round(diffDays / 30)} months`;
}

function repeatError(error: string): string {
  return JSON.stringify({ ok: false, error });
}

// null follows the bucket's default
function parseReminderOffsetsArg(
  value: unknown
): { ok: true; value: number[] | null } | { ok: false; error: string } {
  if (value === null || value === undefined) return { ok: true, value: null };
  const parsed = ReminderOffsets.safeParse(value);
  if (parsed.success) return { ok: true, value: parsed.data };
  return {
    ok: false,
    error: JSON.stringify({ ok: false, error: "Invalid reminders", issues: parsed.error.issues }),
  };
}

function invalidStatusError(status: string): string {
  return JSON.stringify({
    ok: false,
    error: `Unknown status "${status}". Use one of: ${SETTABLE_ITEM_STATUSES.join(", ")}`,
  });
}

// Checked against the bucket's fields; a bucket without fields keeps any values
function validateProperties(
  fieldSchema: unknown,
  properties: Record<string, unknown>
): { ok: true; json: string | null } | { ok: false; error: string } {
  if (!fieldSchema) return { ok: true, json: JSON.stringify(properties) };
  const schema = BucketSchema.safeParse(
    typeof fieldSchema === "string" ? JSON.parse(fieldSchema) : fieldSchema
  );
  if (!schema.success || schema.data.fields.length === 0) return { ok: true, json: null };

  const validated = buildPropertyValidator(schema.data.fields).safeParse(properties);
  if (!validated.success) {
    return {
      ok: false,
      error: JSON.stringify({
        ok: false,
        error: "Invalid properties",
        issues: validated.error.issues,
      }),
    };
  }
  return { ok: true, json: JSON.stringify(validated.data) };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

const ITEM_DETAIL_COLUMNS = {
  id: items.id,
  title: items.title,
  status: items.status,
  bucketId: items.bucketId,
  deadline: items.deadline,
  reminderOffsets: items.reminderOffsets,
  recurring: items.recurring,
  properties: items.properties,
  completedAt: items.completedAt,
};

type ItemDetailRow = {
  id: number;
  title: string;
  status: string;
  bucketId: number;
  deadline: Date | null;
  reminderOffsets: number[] | null;
  recurring: string | null;
  properties: string | null;
  completedAt: Date | null;
};

// Everything the item form shows, so each tool that returns items answers the same questions
function itemDetails(row: ItemDetailRow, timezone: string) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    bucketId: row.bucketId,
    deadline: row.deadline ? localDeadline(row.deadline, timezone) : null,
    deadlineRelative: row.deadline ? deadlineRelative(row.deadline, timezone) : null,
    reminderOffsets: row.reminderOffsets,
    recurring: parseRecurring(row.recurring),
    properties: row.properties ? (JSON.parse(row.properties) as unknown) : null,
    completedAt: row.completedAt ? localTime(row.completedAt, timezone) : null,
  };
}

// Models sometimes invent "today" (e.g. from their training data); a past day is almost always that
function pastDayError(
  deadline: Date | null,
  args: Record<string, unknown>,
  timezone: string
): string | null {
  if (!deadline || args.allow_past === true) return null;
  const now = new Date();
  if (localDateString(deadline, timezone) >= localDateString(now, timezone)) return null;
  return JSON.stringify({
    ok: false,
    error:
      `${localDeadline(deadline, timezone)} is before today (now: ${localTime(now, timezone)}). ` +
      "Pick a date from today on, or pass allow_past: true if the user really means that past date.",
  });
}

async function savedItem(itemId: number, timezone: string) {
  const [row] = await db.select(ITEM_DETAIL_COLUMNS).from(items).where(eq(items.id, itemId));
  return row ? itemDetails(row, timezone) : null;
}

const activeOnly = or(eq(items.status, ITEM_STATUS.active), isNull(items.status));
const notCompleted = notInArray(items.status, CLOSED_ITEM_STATUSES as string[]);

export async function executeToolCall(
  call: ToolCall,
  userId: number,
  timezone = "UTC",
  turnId = nextTurnId()
): Promise<string> {
  try {
    return await executeToolCallInner(call, userId, timezone, turnId);
  } catch (err) {
    recordSystemError("ai-tools", `tool ${call.name} failed: ${errorMessage(err)}`, {
      userId,
      err,
      context: { tool: call.name, argumentNames: Object.keys(call.arguments ?? {}) },
    });
    return JSON.stringify({ ok: false, error: "Tool execution failed" });
  }
}

async function executeToolCallInner(
  call: ToolCall,
  userId: number,
  timezone: string,
  turnId: number
): Promise<string> {
  const args = call.arguments;

  const settingsResult = await executeBucketSettingsTool(call.name, args, userId);
  if (settingsResult !== null) return settingsResult;

  switch (call.name) {
    case "list_buckets": {
      const result = await db
        .select({ id: buckets.id, name: buckets.name, icon: buckets.icon })
        .from(buckets)
        .where(
          and(eq(buckets.userId, userId), isNull(buckets.deletedAt), isNull(buckets.archivedAt))
        );
      return JSON.stringify(result);
    }

    case "create_bucket": {
      const name = String(args.name ?? "").trim();
      if (!name) return JSON.stringify({ ok: false, error: "Name is required" });
      if (name.length > BUCKET_NAME_MAX_LENGTH) {
        return JSON.stringify({
          ok: false,
          error: `Name must be at most ${BUCKET_NAME_MAX_LENGTH} characters`,
        });
      }

      const duplicate = await findBucketByName(userId, name);
      if (duplicate)
        return JSON.stringify({
          ok: false,
          error: `A bucket named "${name}" already exists (id: ${duplicate.id}). Use that bucket instead of creating a new one.`,
        });

      const [maxRow] = await db
        .select({ max: sql<number>`COALESCE(MAX(${buckets.sortOrder}), -1)` })
        .from(buckets)
        .where(eq(buckets.userId, userId));

      const [inserted] = await db
        .insert(buckets)
        .values({
          userId,
          name,
          icon: args.icon ? String(args.icon) : null,
          notificationsRules: JSON.stringify(await withDefaultChannels(userId, {})),
          sortOrder: (maxRow?.max ?? -1) + 1,
          webhookKey: encryptValue(generateWebhookKey()),
        })
        .returning({ id: buckets.id });

      revalidatePath("/");
      return JSON.stringify({ ok: true, bucketId: inserted?.id });
    }

    case "update_bucket": {
      const bucketId = Number(args.bucket_id);
      const bucket = await db.query.buckets.findFirst({
        where: (b, { eq: qeq, and: qand }) => qand(qeq(b.id, bucketId), qeq(b.userId, userId)),
      });
      if (!bucket) return JSON.stringify({ ok: false, error: "Bucket not found" });

      const updates: { updatedAt: Date; name?: string; icon?: string | null } = {
        updatedAt: new Date(),
      };
      if (args.name !== undefined) {
        const name = String(args.name).trim();
        if (!name) return JSON.stringify({ ok: false, error: "Name cannot be empty" });
        if (name.length > BUCKET_NAME_MAX_LENGTH) {
          return JSON.stringify({
            ok: false,
            error: `Name must be at most ${BUCKET_NAME_MAX_LENGTH} characters`,
          });
        }
        if (await findBucketByName(userId, name, bucketId)) {
          return JSON.stringify({ ok: false, error: `A bucket named "${name}" already exists.` });
        }
        updates.name = name;
      }
      if ("icon" in args) {
        updates.icon = args.icon ? String(args.icon) : null;
      }

      await db
        .update(buckets)
        .set(updates)
        .where(and(eq(buckets.id, bucketId), eq(buckets.userId, userId)));

      revalidatePath("/");
      return JSON.stringify({ ok: true });
    }

    case "delete_bucket": {
      const bucketId = Number(args.bucket_id);
      const bucket = await db.query.buckets.findFirst({
        where: (b, { eq: qeq, and: qand }) => qand(qeq(b.id, bucketId), qeq(b.userId, userId)),
      });
      if (!bucket) return JSON.stringify({ ok: false, error: "Bucket not found" });

      if (!confirmDelete(userId, bucketId, turnId)) {
        return JSON.stringify({
          ok: false,
          needsConfirmation: true,
          error: `Nothing deleted yet. Ask the user to confirm deleting "${bucket.name}". When they say yes, call delete_bucket again.`,
        });
      }

      await db
        .update(buckets)
        .set({ deletedAt: new Date() })
        .where(and(eq(buckets.id, bucketId), eq(buckets.userId, userId)));
      await refreshBucketReminders(bucketId);

      revalidatePath("/");
      return JSON.stringify({ ok: true });
    }

    case "add_item": {
      const bucketId = Number(args.bucket_id);
      const title = String(args.title ?? "").trim();
      if (!title) return JSON.stringify({ ok: false, error: "Title is required" });

      const bucket = await db.query.buckets.findFirst({
        where: (b, { eq: qeq, and: qand }) => qand(qeq(b.id, bucketId), qeq(b.userId, userId)),
      });
      if (!bucket) return JSON.stringify({ ok: false, error: "Bucket not found" });

      const [maxRow] = await db
        .select({ max: sql<number>`COALESCE(MAX(${items.sortOrder}), -1)` })
        .from(items)
        .where(eq(items.bucketId, bucketId));

      const reminders = parseReminderOffsetsArg(args.reminder_offsets_mins);
      if (!reminders.ok) return reminders.error;

      const repeat = repeatFromArgs(args, null);
      if (repeat.kind === "error") return repeatError(repeat.error);
      const recurring = repeat.kind === "set" ? repeat.config : null;
      const parsedDeadline = args.deadline
        ? parseLocalDateTime(String(args.deadline), timezone)
        : null;
      if (recurring && !parsedDeadline) return repeatError("A repeating item needs a deadline");
      const deadline = parsedDeadline && onLastDayIfAnchored(parsedDeadline, recurring, timezone);
      const pastDay = pastDayError(deadline, args, timezone);
      if (pastDay) return pastDay;

      const finalStatus = args.status ? String(args.status).trim() : ITEM_STATUS.active;
      if (!SETTABLE_ITEM_STATUSES.includes(finalStatus)) return invalidStatusError(finalStatus);

      let propertiesJson: string | null = null;
      if (isPlainObject(args.properties)) {
        const validated = validateProperties(bucket.fieldSchema, args.properties);
        if (!validated.ok) return validated.error;
        propertiesJson = validated.json;
      }

      const [inserted] = await db
        .insert(items)
        .values({
          bucketId,
          userId,
          title,
          status: finalStatus,
          completedAt: finalStatus === ITEM_STATUS.completed ? new Date() : null,
          deadline,
          ...initialReminderState(deadline, timezone),
          reminderOffsets: reminders.value,
          recurring: recurring ? JSON.stringify(recurring) : null,
          properties: propertiesJson,
          source: "ai",
          sortOrder: (maxRow?.max ?? -1) + 1,
        })
        .returning({ id: items.id });
      if (inserted) await refreshItemReminders([inserted.id]);

      revalidatePath("/");
      return JSON.stringify({
        ok: true,
        itemId: inserted?.id,
        item: inserted ? await savedItem(inserted.id, timezone) : null,
      });
    }

    case "update_item": {
      const itemId = Number(args.item_id);
      const item = await db.query.items.findFirst({
        where: (i, { eq: qeq, and: qand }) => qand(qeq(i.id, itemId), qeq(i.userId, userId)),
      });
      if (!item) return JSON.stringify({ ok: false, error: "Item not found" });

      const updates: {
        updatedAt: Date;
        title?: string;
        deadline?: Date | null;
        scheduledAt?: null;
        notifiedAt?: Date | null;
        overdueNotifiedAt?: Date | null;
        remindNotBefore?: Date | null;
        reminderOffsets?: number[] | null;
        recurring?: string | null;
        status?: string;
        completedAt?: Date | null;
        properties?: string | null;
      } = { updatedAt: new Date() };

      if (args.title !== undefined) {
        const title = String(args.title).trim();
        if (!title) return JSON.stringify({ ok: false, error: "Title cannot be empty" });
        updates.title = title;
      }

      const repeat = repeatFromArgs(args, parseRecurring(item.recurring));
      if (repeat.kind === "error") return repeatError(repeat.error);
      const recurring =
        repeat.kind === "none"
          ? parseRecurring(item.recurring)
          : repeat.kind === "set"
            ? repeat.config
            : null;
      if (repeat.kind !== "none") updates.recurring = recurring ? JSON.stringify(recurring) : null;
      if (repeat.kind === "clear") updates.scheduledAt = null;

      const askedDeadline =
        "deadline" in args
          ? args.deadline
            ? parseLocalDateTime(String(args.deadline), timezone)
            : null
          : item.deadline;
      const touchesSchedule = "deadline" in args || repeat.kind === "set";
      if (touchesSchedule && recurring && !askedDeadline) {
        return repeatError("A repeating item needs a deadline");
      }
      const newDeadline =
        askedDeadline && touchesSchedule
          ? onLastDayIfAnchored(askedDeadline, recurring, timezone)
          : askedDeadline;
      const pastDay = "deadline" in args ? pastDayError(newDeadline, args, timezone) : null;
      if (pastDay) return pastDay;
      if ("deadline" in args || newDeadline?.getTime() !== item.deadline?.getTime()) {
        updates.deadline = newDeadline;
        if (newDeadline?.getTime() !== item.deadline?.getTime()) updates.scheduledAt = null;
        Object.assign(
          updates,
          reminderResetForDeadline(item, newDeadline, await reminderContext(item.bucketId))
        );
      }
      if ("reminder_offsets_mins" in args) {
        const reminders = parseReminderOffsetsArg(args.reminder_offsets_mins);
        if (!reminders.ok) return reminders.error;
        updates.reminderOffsets = reminders.value;
      }

      if (args.status !== undefined) {
        const statusName = String(args.status).trim();
        if (!SETTABLE_ITEM_STATUSES.includes(statusName)) return invalidStatusError(statusName);
        updates.status = statusName;
        if (statusName === ITEM_STATUS.completed && item.status !== ITEM_STATUS.completed)
          updates.completedAt = new Date();
        else if (statusName !== ITEM_STATUS.completed && item.status === ITEM_STATUS.completed)
          updates.completedAt = null;
      }

      if (args.properties !== undefined) {
        if (args.properties === null) {
          updates.properties = null;
        } else if (isPlainObject(args.properties)) {
          const bucket = await db.query.buckets.findFirst({
            where: (b, { eq: qeq }) => qeq(b.id, item.bucketId),
            columns: { fieldSchema: true },
          });
          const saved = item.properties
            ? (JSON.parse(item.properties) as Record<string, unknown>)
            : {};
          const validated = validateProperties(bucket?.fieldSchema, {
            ...saved,
            ...args.properties,
          });
          if (!validated.ok) return validated.error;
          updates.properties = validated.json;
        }
      }

      await db
        .update(items)
        .set(updates)
        .where(and(eq(items.id, itemId), eq(items.userId, userId)));
      await refreshItemReminders([itemId]);
      if (updates.status === ITEM_STATUS.completed) await createNextOccurrence(itemId);

      revalidatePath("/");
      return JSON.stringify({ ok: true, item: await savedItem(itemId, timezone) });
    }

    case "complete_item": {
      const itemId = Number(args.item_id);
      const item = await db.query.items.findFirst({
        where: (i, { eq: qeq, and: qand }) => qand(qeq(i.id, itemId), qeq(i.userId, userId)),
      });
      if (!item) return JSON.stringify({ ok: false, error: "Item not found" });

      const newStatus = await toggleItemCompleted(item);

      revalidatePath("/");
      return JSON.stringify({ ok: true, newStatus });
    }

    case "delete_item": {
      const itemId = Number(args.item_id);
      const item = await db.query.items.findFirst({
        where: (i, { eq: qeq, and: qand }) => qand(qeq(i.id, itemId), qeq(i.userId, userId)),
      });
      if (!item) return JSON.stringify({ ok: false, error: "Item not found" });

      await db
        .update(items)
        .set({ deletedAt: new Date(), deletedBy: userId })
        .where(and(eq(items.id, itemId), eq(items.userId, userId)));
      await refreshItemReminders([itemId]);

      revalidatePath("/");
      return JSON.stringify({ ok: true });
    }

    case "move_item": {
      const itemId = Number(args.item_id);
      const destBucketId = Number(args.bucket_id);

      const [item, destBucket] = await Promise.all([
        db.query.items.findFirst({
          where: (i, { eq: qeq, and: qand }) => qand(qeq(i.id, itemId), qeq(i.userId, userId)),
        }),
        db.query.buckets.findFirst({
          where: (b, { eq: qeq, and: qand }) =>
            qand(qeq(b.id, destBucketId), qeq(b.userId, userId)),
        }),
      ]);
      if (!item) return JSON.stringify({ ok: false, error: "Item not found" });
      if (!destBucket) return JSON.stringify({ ok: false, error: "Destination bucket not found" });

      const [maxRow] = await db
        .select({ max: sql<number>`COALESCE(MAX(${items.sortOrder}), -1)` })
        .from(items)
        .where(eq(items.bucketId, destBucketId));

      await db
        .update(items)
        .set({ bucketId: destBucketId, sortOrder: (maxRow?.max ?? -1) + 1, updatedAt: new Date() })
        .where(and(eq(items.id, itemId), eq(items.userId, userId)));
      await refreshItemReminders([itemId]);

      revalidatePath("/");
      return JSON.stringify({ ok: true });
    }

    case "list_items": {
      const bucketId = Number(args.bucket_id);
      const includeCompleted = Boolean(args.include_completed ?? false);

      const [bucket] = await db
        .select({ id: buckets.id })
        .from(buckets)
        .where(and(eq(buckets.id, bucketId), eq(buckets.userId, userId), inLiveBucket));
      if (!bucket) return JSON.stringify({ ok: false, error: "Bucket not found" });

      const rows = await db
        .select(ITEM_DETAIL_COLUMNS)
        .from(items)
        .where(
          includeCompleted
            ? and(eq(items.bucketId, bucketId), eq(items.userId, userId), isNull(items.deletedAt))
            : and(
                eq(items.bucketId, bucketId),
                eq(items.userId, userId),
                isNull(items.deletedAt),
                notCompleted
              )
        );

      return JSON.stringify(rows.map((row) => itemDetails(row, timezone)));
    }

    case "search_items": {
      const keyword = args.keyword ? String(args.keyword).trim() : null;
      const deadlineFilter = (args.deadline_filter as string | undefined) ?? "all";
      const bucketId = args.bucket_id !== undefined ? Number(args.bucket_id) : null;
      const includeCompleted = Boolean(args.include_completed ?? false);
      const completedWithinDays =
        args.completed_within_days !== undefined ? Number(args.completed_within_days) : null;
      const dueWithinDays =
        args.due_within_days !== undefined ? Number(args.due_within_days) : null;

      const now = new Date();
      const wantsCompleted = includeCompleted || completedWithinDays !== null;

      const conditions = [
        eq(items.userId, userId),
        isNull(items.deletedAt),
        ...(wantsCompleted ? [] : [notCompleted]),
        ...(bucketId !== null ? [eq(items.bucketId, bucketId)] : []),
        ...(completedWithinDays !== null
          ? [gte(items.completedAt, new Date(now.getTime() - completedWithinDays * 86_400_000))]
          : []),
        ...(dueWithinDays !== null
          ? [lte(items.deadline, new Date(now.getTime() + dueWithinDays * 86_400_000))]
          : []),
      ];

      const rows = await db
        .select({ ...ITEM_DETAIL_COLUMNS, bucketName: buckets.name })
        .from(items)
        .innerJoin(buckets, eq(buckets.id, items.bucketId))
        .where(and(...conditions, inLiveBucket));

      const keywordWords = keyword ? keyword.toLowerCase().split(/\s+/).filter(Boolean) : null;

      const enriched = rows
        .filter((row) => {
          if (!keywordWords) return true;
          const lower = row.title.toLowerCase();
          return keywordWords.every((w) => lower.includes(w));
        })
        .map((row) => ({
          ...itemDetails(row, timezone),
          bucket: row.bucketName,
        }))
        .filter((row) => {
          if (deadlineFilter === "all") return true;
          if (!row.deadlineRelative) return false;
          if (deadlineFilter === "overdue") return row.deadlineRelative.startsWith("overdue");
          if (deadlineFilter === "today") {
            return row.deadlineRelative === "today" || row.deadlineRelative === "overdue today";
          }
          if (deadlineFilter === "tomorrow") return row.deadlineRelative === "tomorrow";
          if (deadlineFilter === "this_week") {
            return (
              row.deadlineRelative === "today" ||
              row.deadlineRelative === "overdue today" ||
              row.deadlineRelative === "tomorrow" ||
              row.deadlineRelative.startsWith("in ")
            );
          }
          return true;
        });

      return JSON.stringify(enriched);
    }

    default:
      return JSON.stringify({ ok: false, error: `Unknown tool: ${call.name}` });
  }
}

export async function getUpcomingItems(userId: number, timezone: string): Promise<UpcomingItem[]> {
  const weekFromNow = new Date(Date.now() + 7 * 86_400_000);

  const rows = await db
    .select({
      id: items.id,
      title: items.title,
      deadline: items.deadline,
      bucketName: buckets.name,
    })
    .from(items)
    .innerJoin(buckets, eq(buckets.id, items.bucketId))
    .where(
      and(
        eq(items.userId, userId),
        isNull(items.deletedAt),
        inLiveBucket,
        activeOnly,
        lte(items.deadline, weekFromNow)
      )
    );

  return rows
    .filter((row): row is typeof row & { deadline: Date } => row.deadline !== null)
    .map((row) => ({
      id: row.id,
      title: row.title,
      bucket: row.bucketName,
      deadlineRelative: deadlineRelative(row.deadline, timezone),
      deadline: row.deadline,
    }))
    .sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
}

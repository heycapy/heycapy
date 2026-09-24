import { revalidatePath } from "next/cache";
import { and, eq, gte, isNull, lte, ne, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, items } from "@/lib/db/schema";
import { RecurringConfig, BucketSchema, buildPropertyValidator } from "@/types/rules";
import type { ToolCall } from "./types";

export { CAPY_TOOLS } from "./capyToolDefs";

export type UpcomingItem = {
  id: number;
  title: string;
  bucket: string;
  deadlineRelative: string;
  deadline: Date;
};

/**
 * Parse a deadline string from the AI in the context of the user's timezone.
 * - If the string already carries an offset (e.g. +05:30) or Z, parse as-is.
 * - If it's a naive datetime (no offset), interpret it as the user's local time
 *   and convert to the correct UTC instant.
 * - If it's a date-only string (YYYY-MM-DD), treat it as midnight in the user's TZ.
 */
function parseDeadlineInTimezone(str: string, timezone: string): Date {
  const s = str.trim();

  // Already has an offset or Z — parse directly
  if (/Z$|[+-]\d{2}:\d{2}$/.test(s)) return new Date(s);

  // Date-only: YYYY-MM-DD — treat as midnight in user's TZ by appending T00:00:00 and falling through
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00` : s;

  // Parse as if UTC to extract the numeric components
  const naiveUtc = new Date(`${normalized}Z`);
  if (isNaN(naiveUtc.getTime())) return new Date(s); // fallback for unparseable strings

  // Get what the user's local time looks like at that UTC instant
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(naiveUtc);
  const localMs = Date.UTC(
    Number(parts.find((p) => p.type === "year")?.value ?? 0),
    Number(parts.find((p) => p.type === "month")?.value ?? 1) - 1,
    Number(parts.find((p) => p.type === "day")?.value ?? 1),
    Number(parts.find((p) => p.type === "hour")?.value ?? 0),
    Number(parts.find((p) => p.type === "minute")?.value ?? 0),
    Number(parts.find((p) => p.type === "second")?.value ?? 0)
  );
  // offsetMs = UTC - local (positive for timezones east of UTC like IST)
  const offsetMs = naiveUtc.getTime() - localMs;
  return new Date(naiveUtc.getTime() + offsetMs);
}

function toDateStr(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const mo = parts.find((p) => p.type === "month")?.value ?? "";
  const dy = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}-${mo}-${dy}`;
}

function deadlineRelative(deadline: Date, timezone: string): string {
  const now = new Date();
  const todayStr = toDateStr(now, timezone);
  const deadlineStr = toDateStr(deadline, timezone);

  if (deadlineStr < todayStr) return "overdue";
  if (deadlineStr === todayStr) return "today";

  const tomorrowStr = toDateStr(new Date(now.getTime() + 86_400_000), timezone);
  if (deadlineStr === tomorrowStr) return "tomorrow";

  const diffDays = Math.round((deadline.getTime() - now.getTime()) / 86_400_000);
  if (diffDays <= 7) return `in ${diffDays} days`;
  if (diffDays <= 30) return `in ${Math.round(diffDays / 7)} weeks`;
  return `in ${Math.round(diffDays / 30)} months`;
}

function parseRecurringArgs(args: Record<string, unknown>): string | null | undefined {
  if (args.clear_recurring === true) return null;
  if (args.recurring_frequency === undefined) return undefined;

  const config = RecurringConfig.parse({
    enabled: true,
    frequency: args.recurring_frequency,
    interval: args.recurring_interval ?? 1,
    endDate: args.recurring_end_date ?? null,
  });
  return JSON.stringify(config);
}

const activeOnly = or(eq(items.status, "active"), isNull(items.status));
const notCompleted = ne(items.status, "completed");

export async function executeToolCall(
  call: ToolCall,
  userId: number,
  timezone = "UTC"
): Promise<string> {
  try {
    return await executeToolCallInner(call, userId, timezone);
  } catch (err) {
    process.stderr.write(
      `[ai-tools] tool ${call.name} failed: ${err instanceof Error ? err.message : String(err)}\n`
    );
    return JSON.stringify({ ok: false, error: "Tool execution failed" });
  }
}

async function executeToolCallInner(
  call: ToolCall,
  userId: number,
  timezone = "UTC"
): Promise<string> {
  const args = call.arguments;

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

      const [duplicate] = await db
        .select({ id: buckets.id })
        .from(buckets)
        .where(
          and(
            eq(buckets.userId, userId),
            isNull(buckets.deletedAt),
            sql`lower(${buckets.name}) = lower(${name})`
          )
        )
        .limit(1);
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
          sortOrder: (maxRow?.max ?? -1) + 1,
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

      await db
        .update(buckets)
        .set({ deletedAt: new Date() })
        .where(and(eq(buckets.id, bucketId), eq(buckets.userId, userId)));

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

      const deadline = args.deadline
        ? parseDeadlineInTimezone(String(args.deadline), timezone)
        : null;
      const notificationOffsetMins =
        args.notification_offset_mins !== null && args.notification_offset_mins !== undefined
          ? Number(args.notification_offset_mins)
          : null;

      let recurringJson: string | null = null;
      try {
        const parsed = parseRecurringArgs(args);
        if (parsed !== undefined) recurringJson = parsed;
      } catch {
        return JSON.stringify({ ok: false, error: "Invalid recurring configuration" });
      }

      const statusArg = args.status ? String(args.status).trim() : "active";
      const finalStatus = statusArg || "active";

      let schemaParsed: ReturnType<typeof BucketSchema.safeParse> | null = null;
      if (bucket.fieldSchema) {
        schemaParsed = BucketSchema.safeParse(
          typeof bucket.fieldSchema === "string"
            ? JSON.parse(bucket.fieldSchema)
            : bucket.fieldSchema
        );
      }

      let propertiesJson: string | null = null;
      if (
        args.properties &&
        typeof args.properties === "object" &&
        !Array.isArray(args.properties)
      ) {
        if (schemaParsed?.success && schemaParsed.data.fields.length > 0) {
          const validator = buildPropertyValidator(schemaParsed.data.fields);
          const validated = validator.safeParse(args.properties);
          if (!validated.success)
            return JSON.stringify({
              ok: false,
              error: "Invalid properties",
              issues: validated.error.issues,
            });
          propertiesJson = JSON.stringify(validated.data);
        } else if (!bucket.fieldSchema) {
          propertiesJson = JSON.stringify(args.properties);
        }
      }

      const [inserted] = await db
        .insert(items)
        .values({
          bucketId,
          userId,
          title,
          status: finalStatus,
          completedAt: finalStatus === "completed" ? new Date() : null,
          deadline,
          notificationOffsetMins,
          recurring: recurringJson,
          properties: propertiesJson,
          source: "ai",
          sortOrder: (maxRow?.max ?? -1) + 1,
        })
        .returning({ id: items.id });

      revalidatePath("/");
      return JSON.stringify({ ok: true, itemId: inserted?.id });
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
        notifiedAt?: Date | null;
        overdueNotifiedAt?: Date | null;
        notificationOffsetMins?: number | null;
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
      if ("deadline" in args) {
        const newDeadline = args.deadline
          ? parseDeadlineInTimezone(String(args.deadline), timezone)
          : null;
        updates.deadline = newDeadline;
        if ((item.deadline?.getTime() ?? null) !== (newDeadline?.getTime() ?? null)) {
          updates.notifiedAt = null;
          updates.overdueNotifiedAt = null;
        }
      }
      if ("notification_offset_mins" in args) {
        updates.notificationOffsetMins =
          args.notification_offset_mins !== null && args.notification_offset_mins !== undefined
            ? Number(args.notification_offset_mins)
            : null;
      }

      try {
        const parsed = parseRecurringArgs(args);
        if (parsed !== undefined) updates.recurring = parsed;
      } catch {
        return JSON.stringify({ ok: false, error: "Invalid recurring configuration" });
      }

      if (args.status !== undefined) {
        const statusName = String(args.status).trim();
        if (statusName) {
          updates.status = statusName;
          if (statusName === "completed" && item.status !== "completed")
            updates.completedAt = new Date();
          else if (statusName !== "completed" && item.status === "completed")
            updates.completedAt = null;
        }
      }

      if (args.properties !== undefined) {
        if (args.properties === null) {
          updates.properties = null;
        } else if (typeof args.properties === "object" && !Array.isArray(args.properties)) {
          updates.properties = JSON.stringify(args.properties);
        }
      }

      await db
        .update(items)
        .set(updates)
        .where(and(eq(items.id, itemId), eq(items.userId, userId)));

      revalidatePath("/");
      return JSON.stringify({ ok: true });
    }

    case "complete_item": {
      const itemId = Number(args.item_id);
      const item = await db.query.items.findFirst({
        where: (i, { eq: qeq, and: qand }) => qand(qeq(i.id, itemId), qeq(i.userId, userId)),
      });
      if (!item) return JSON.stringify({ ok: false, error: "Item not found" });

      const newStatus = item.status === "completed" ? "active" : "completed";
      await db
        .update(items)
        .set({
          status: newStatus,
          completedAt: newStatus === "completed" ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(and(eq(items.id, itemId), eq(items.userId, userId)));

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
        .set({ deletedAt: new Date() })
        .where(and(eq(items.id, itemId), eq(items.userId, userId)));

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

      revalidatePath("/");
      return JSON.stringify({ ok: true });
    }

    case "snooze_item": {
      const itemId = Number(args.item_id);
      const item = await db.query.items.findFirst({
        where: (i, { eq: qeq, and: qand }) => qand(qeq(i.id, itemId), qeq(i.userId, userId)),
      });
      if (!item) return JSON.stringify({ ok: false, error: "Item not found" });

      const snoozedUntil = args.snooze_until
        ? parseDeadlineInTimezone(String(args.snooze_until), timezone)
        : null;
      await db
        .update(items)
        .set({ snoozedUntil, updatedAt: new Date() })
        .where(and(eq(items.id, itemId), eq(items.userId, userId)));

      revalidatePath("/");
      return JSON.stringify({ ok: true });
    }

    case "list_items": {
      const bucketId = Number(args.bucket_id);
      const includeCompleted = Boolean(args.include_completed ?? false);

      const bucket = await db.query.buckets.findFirst({
        where: (b, { eq: qeq, and: qand }) => qand(qeq(b.id, bucketId), qeq(b.userId, userId)),
      });
      if (!bucket) return JSON.stringify({ ok: false, error: "Bucket not found" });

      const rows = await db
        .select({
          id: items.id,
          title: items.title,
          deadline: items.deadline,
          status: items.status,
          notificationOffsetMins: items.notificationOffsetMins,
          snoozedUntil: items.snoozedUntil,
          recurring: items.recurring,
          properties: items.properties,
        })
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

      const enriched = rows.map((row) => ({
        ...row,
        recurring: row.recurring ? (JSON.parse(row.recurring) as unknown) : null,
        properties: row.properties ? (JSON.parse(row.properties) as unknown) : null,
        deadlineRelative: row.deadline ? deadlineRelative(row.deadline, timezone) : null,
      }));
      return JSON.stringify(enriched);
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

      const [rows, bucketRows] = await Promise.all([
        db
          .select({
            id: items.id,
            title: items.title,
            deadline: items.deadline,
            status: items.status,
            bucketId: items.bucketId,
            notificationOffsetMins: items.notificationOffsetMins,
            snoozedUntil: items.snoozedUntil,
            completedAt: items.completedAt,
          })
          .from(items)
          .where(and(...conditions)),
        db
          .select({ id: buckets.id, name: buckets.name })
          .from(buckets)
          .where(and(eq(buckets.userId, userId), isNull(buckets.deletedAt))),
      ]);

      const keywordWords = keyword ? keyword.toLowerCase().split(/\s+/).filter(Boolean) : null;
      const bucketMap = new Map(bucketRows.map((b) => [b.id, b.name]));

      const enriched = rows
        .filter((row) => {
          if (!keywordWords) return true;
          const lower = row.title.toLowerCase();
          return keywordWords.every((w) => lower.includes(w));
        })
        .map((row) => ({
          id: row.id,
          title: row.title,
          status: row.status,
          bucket: bucketMap.get(row.bucketId) ?? "Unknown",
          bucketId: row.bucketId,
          deadline: row.deadline,
          deadlineRelative: row.deadline ? deadlineRelative(row.deadline, timezone) : null,
          snoozedUntil: row.snoozedUntil,
          completedAt: row.completedAt,
        }))
        .filter((row) => {
          if (deadlineFilter === "all") return true;
          if (!row.deadlineRelative) return false;
          if (deadlineFilter === "overdue") return row.deadlineRelative === "overdue";
          if (deadlineFilter === "today") return row.deadlineRelative === "today";
          if (deadlineFilter === "tomorrow") return row.deadlineRelative === "tomorrow";
          if (deadlineFilter === "this_week") {
            return (
              row.deadlineRelative === "today" ||
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

  const [rows, bucketRows] = await Promise.all([
    db
      .select({
        id: items.id,
        title: items.title,
        deadline: items.deadline,
        bucketId: items.bucketId,
      })
      .from(items)
      .where(
        and(
          eq(items.userId, userId),
          isNull(items.deletedAt),
          activeOnly,
          lte(items.deadline, weekFromNow)
        )
      ),
    db
      .select({ id: buckets.id, name: buckets.name })
      .from(buckets)
      .where(and(eq(buckets.userId, userId), isNull(buckets.deletedAt))),
  ]);

  const bucketMap = new Map(bucketRows.map((b) => [b.id, b.name]));

  return rows
    .filter((row): row is typeof row & { deadline: Date } => row.deadline !== null)
    .map((row) => ({
      id: row.id,
      title: row.title,
      bucket: bucketMap.get(row.bucketId) ?? "Unknown",
      deadlineRelative: deadlineRelative(row.deadline, timezone),
      deadline: row.deadline,
    }))
    .sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
}

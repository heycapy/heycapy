"use server";

import type { ActionResult } from "@/types/result";
import { parseItemsRules } from "@/lib/rules";
import { revalidatePath } from "next/cache";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { requireSession } from "./action-helpers";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { findAccessibleBucket, findAccessibleItem, isBucketMember } from "@/lib/buckets/access";
import { ITEM_STATUS, ITEM_TITLE_MAX_LENGTH } from "@/constants";
import { RecurringConfig, ReminderOffsets } from "@/types/rules";
import { parseLocalDateTime } from "@/lib/reminders/zoned";
import { initialReminderState, reminderResetForDeadline } from "@/lib/items/reminders";
import { refreshItemReminders, reminderContext } from "@/lib/reminders/refresh";
import { createNextOccurrence, moveOccurrence, skipOccurrence } from "@/lib/items/recurrence";
import { onLastDayIfAnchored, parseRecurring } from "@/lib/items/occurrence";
import { cancelRemindAgain } from "@/lib/reminders/quick-actions";
import { toggleItemCompleted } from "@/lib/items/complete";
import { dataEvents } from "@/lib/events";
import {
  getItemReminderInfo,
  getReminderBadges,
  type ItemReminderInfo,
  type ReminderBadge,
} from "@/lib/reminders/status";

export async function getItemsForBucketAction(bucketId: number): Promise<
  ActionResult<{
    items: (typeof items.$inferSelect)[];
    reminderBadges: Record<number, ReminderBadge>;
  }>
> {
  const session = await requireSession();

  const bucket = await findAccessibleBucket(session.userId, bucketId);
  if (!bucket) return { ok: false, error: "Bucket not found" };

  const sortBy = parseItemsRules(bucket.itemsRules).sortBy ?? "manual";

  const condition = and(eq(items.bucketId, bucketId), isNull(items.deletedAt));

  const result =
    sortBy === "deadline"
      ? await db
          .select()
          .from(items)
          .where(condition)
          .orderBy(
            sql`${items.deadline} IS NULL`,
            asc(items.deadline),
            asc(items.createdAt),
            asc(items.id)
          )
      : sortBy === "created_at"
        ? await db
            .select()
            .from(items)
            .where(condition)
            .orderBy(asc(items.createdAt), asc(items.id))
        : await db
            .select()
            .from(items)
            .where(condition)
            .orderBy(asc(items.sortOrder), asc(items.createdAt), asc(items.id));

  const reminderBadges = await getReminderBadges(session.userId, bucket.notificationsRules, result);
  return { ok: true, items: result, reminderBadges };
}

export async function getItemReminderInfoAction(itemId: number): Promise<ItemReminderInfo | null> {
  const session = await requireSession();
  return getItemReminderInfo(session.userId, itemId);
}

export async function cancelRemindAgainAction(itemId: number): Promise<ActionResult> {
  const session = await requireSession();
  if (!(await cancelRemindAgain(session.userId, itemId, "app"))) {
    return { ok: false, error: "nothing to cancel — it may have already gone out" };
  }
  dataEvents.emit("refresh", session.userId);
  revalidatePath("/");
  return { ok: true };
}

const NOT_A_MEMBER_ERROR = "That person isn't in this bucket";

export async function addItemAction(
  bucketId: number,
  title: string,
  deadline: string | null,
  status?: string,
  recurring?: RecurringConfig | null,
  properties?: Record<string, unknown> | null,
  reminders?: number[] | null,
  assigneeId?: number | null
): Promise<ActionResult> {
  const session = await requireSession();

  const trimmed = title.trim();
  if (!trimmed) return { ok: false, error: "Title is required" };
  if (trimmed.length > ITEM_TITLE_MAX_LENGTH) return { ok: false, error: "Title too long" };
  if (recurring && !RecurringConfig.safeParse(recurring).success) {
    return { ok: false, error: "Invalid repeat settings" };
  }
  const parsedReminders = reminders ? ReminderOffsets.safeParse(reminders) : null;
  if (parsedReminders && !parsedReminders.success) {
    return { ok: false, error: "Invalid reminders" };
  }

  const bucket = await findAccessibleBucket(session.userId, bucketId);
  if (!bucket) return { ok: false, error: "Bucket not found" };
  if (assigneeId && !(await isBucketMember(assigneeId, bucketId))) {
    return { ok: false, error: NOT_A_MEMBER_ERROR };
  }

  const [maxRow] = await db
    .select({ max: sql<number>`COALESCE(MAX(${items.sortOrder}), -1)` })
    .from(items)
    .where(eq(items.bucketId, bucketId));

  const ctx = await reminderContext(bucketId);
  const parsedDeadline = deadline
    ? onLastDayIfAnchored(
        parseLocalDateTime(deadline, ctx.timezone),
        recurring ?? null,
        ctx.timezone
      )
    : null;
  const [created] = await db
    .insert(items)
    .values({
      bucketId,
      userId: session.userId,
      title: trimmed,
      deadline: parsedDeadline,
      ...initialReminderState(parsedDeadline, ctx.timezone),
      status: status ?? ITEM_STATUS.active,
      sortOrder: maxRow.max + 1,
      recurring: recurring?.enabled ? JSON.stringify(recurring) : null,
      properties: properties ? JSON.stringify(properties) : null,
      reminderOffsets: parsedReminders?.data ?? null,
      assigneeId: assigneeId ?? null,
    })
    .returning({ id: items.id });
  if (created) await refreshItemReminders([created.id]);

  revalidatePath("/");
  return { ok: true };
}

// The editor doesn't know the series anchor; keep it while the frequency stays the same
function keepAnchor(config: RecurringConfig, saved: string | null): RecurringConfig {
  if (config.anchorDay) return config;
  const previous = parseRecurring(saved);
  return previous?.frequency === config.frequency && previous.anchorDay
    ? { ...config, anchorDay: previous.anchorDay }
    : config;
}

export async function updateItemAction(
  itemId: number,
  title: string,
  deadline: string | null,
  status?: string,
  recurring?: RecurringConfig | null,
  properties?: Record<string, unknown> | null,
  reminders?: number[] | null,
  assigneeId?: number | null
): Promise<ActionResult> {
  const session = await requireSession();

  const trimmed = title.trim();
  if (!trimmed) return { ok: false, error: "Title is required" };
  if (trimmed.length > ITEM_TITLE_MAX_LENGTH) return { ok: false, error: "Title too long" };
  if (recurring && !RecurringConfig.safeParse(recurring).success) {
    return { ok: false, error: "Invalid repeat settings" };
  }
  const parsedReminders = reminders ? ReminderOffsets.safeParse(reminders) : null;
  if (parsedReminders && !parsedReminders.success) {
    return { ok: false, error: "Invalid reminders" };
  }

  const item = await findAccessibleItem(session.userId, itemId);
  if (!item) return { ok: false, error: "Item not found" };
  if (assigneeId && !(await isBucketMember(assigneeId, item.bucketId))) {
    return { ok: false, error: NOT_A_MEMBER_ERROR };
  }

  const ctx = await reminderContext(item.bucketId);
  const savedRecurring =
    recurring === undefined
      ? parseRecurring(item.recurring)
      : recurring?.enabled
        ? keepAnchor(recurring, item.recurring)
        : null;
  const parsedDeadline = deadline ? parseLocalDateTime(deadline, ctx.timezone) : null;
  const keepsMovedDate =
    !!item.scheduledAt &&
    !!savedRecurring &&
    parsedDeadline?.getTime() === item.deadline?.getTime();
  const newDeadline =
    parsedDeadline && !keepsMovedDate
      ? onLastDayIfAnchored(parsedDeadline, savedRecurring, ctx.timezone)
      : parsedDeadline;
  const statusChanged = status !== undefined && status !== item.status;

  const nowCompleted =
    statusChanged && status === ITEM_STATUS.completed && item.status !== ITEM_STATUS.completed;
  const nowUncompleted =
    statusChanged && status !== ITEM_STATUS.completed && item.status === ITEM_STATUS.completed;

  await db
    .update(items)
    .set({
      title: trimmed,
      deadline: newDeadline,
      ...(!keepsMovedDate && { scheduledAt: null }),
      ...reminderResetForDeadline(item, newDeadline, ctx),
      ...(status !== undefined && { status }),
      ...(nowCompleted && { completedAt: new Date() }),
      ...(nowUncompleted && { completedAt: null }),
      ...(recurring !== undefined && {
        recurring: savedRecurring ? JSON.stringify(savedRecurring) : null,
      }),
      ...(properties !== undefined && {
        properties: properties ? JSON.stringify(properties) : null,
      }),
      ...(reminders !== undefined && { reminderOffsets: parsedReminders?.data ?? null }),
      ...(assigneeId !== undefined && { assigneeId }),
      updatedAt: new Date(),
    })
    .where(eq(items.id, itemId));
  await refreshItemReminders([itemId]);
  if (nowCompleted) await createNextOccurrence(itemId);

  revalidatePath("/");
  return { ok: true };
}

export async function skipOccurrenceAction(itemId: number): Promise<ActionResult> {
  const session = await requireSession();
  const result = await skipOccurrence(session.userId, itemId);
  if (result.ok) revalidatePath("/");
  return result;
}

export async function moveItemAction(itemId: number, deadline: string): Promise<ActionResult> {
  const session = await requireSession();

  const item = await findAccessibleItem(session.userId, itemId);
  if (!item) return { ok: false, error: "Item not found" };

  const ctx = await reminderContext(item.bucketId);
  const parsed = parseLocalDateTime(deadline, ctx.timezone);
  if (isNaN(parsed.getTime())) return { ok: false, error: "Invalid date" };

  const result = await moveOccurrence(session.userId, itemId, parsed);
  if (!result.ok) return result;
  revalidatePath("/");
  return { ok: true };
}

export async function completeItemAction(itemId: number): Promise<ActionResult> {
  const session = await requireSession();

  const item = await findAccessibleItem(session.userId, itemId);
  if (!item) return { ok: false, error: "Item not found" };

  await toggleItemCompleted(item);

  revalidatePath("/");
  return { ok: true };
}

export async function reorderItemsAction(
  bucketId: number,
  orderedIds: number[]
): Promise<ActionResult> {
  const session = await requireSession();

  const bucket = await findAccessibleBucket(session.userId, bucketId);
  if (!bucket) return { ok: false, error: "Bucket not found" };

  await Promise.all(
    orderedIds.map((id, i) =>
      db
        .update(items)
        .set({ sortOrder: i })
        .where(and(eq(items.id, id), eq(items.bucketId, bucketId)))
    )
  );

  revalidatePath("/");
  return { ok: true };
}

export async function deleteItemAction(itemId: number): Promise<ActionResult> {
  const session = await requireSession();

  const item = await findAccessibleItem(session.userId, itemId);
  if (!item) return { ok: false, error: "Item not found" };

  await db
    .update(items)
    .set({ deletedAt: new Date(), deletedBy: session.userId })
    .where(eq(items.id, itemId));
  await refreshItemReminders([itemId]);

  revalidatePath("/");
  return { ok: true };
}

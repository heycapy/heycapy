"use server";

import type { ActionResult } from "@/types/result";
import { parseItemsRules } from "@/lib/rules";
import { revalidatePath } from "next/cache";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { requireSession } from "./action-helpers";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { ITEM_STATUS, ITEM_TITLE_MAX_LENGTH } from "@/constants";
import { RecurringConfig } from "@/types/rules";
import { parseLocalDateTime } from "@/lib/reminders/zoned";
import { initialReminderState, reminderResetForDeadline } from "@/lib/items/reminders";
import { refreshItemReminders, reminderContext } from "@/lib/reminders/refresh";
import { createNextOccurrence, skipOccurrence } from "@/lib/items/recurrence";
import { parseRecurring } from "@/lib/items/occurrence";
import { cancelRemindAgain } from "@/lib/reminders/quick-actions";
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

  const bucket = await db.query.buckets.findFirst({
    where: (b, { eq: qeq, and: qand }) => qand(qeq(b.id, bucketId), qeq(b.userId, session.userId)),
  });
  if (!bucket) return { ok: false, error: "Bucket not found" };

  const sortBy = parseItemsRules(bucket.itemsRules).sortBy ?? "manual";

  const condition = and(
    eq(items.bucketId, bucketId),
    eq(items.userId, session.userId),
    isNull(items.deletedAt)
  );

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

export async function addItemAction(
  bucketId: number,
  title: string,
  deadline: string | null,
  status?: string,
  recurring?: RecurringConfig | null,
  properties?: Record<string, unknown> | null
): Promise<ActionResult> {
  const session = await requireSession();

  const trimmed = title.trim();
  if (!trimmed) return { ok: false, error: "Title is required" };
  if (trimmed.length > ITEM_TITLE_MAX_LENGTH) return { ok: false, error: "Title too long" };
  if (recurring && !RecurringConfig.safeParse(recurring).success) {
    return { ok: false, error: "Invalid repeat settings" };
  }

  const bucket = await db.query.buckets.findFirst({
    where: (b, { eq: qeq, and: qand }) => qand(qeq(b.id, bucketId), qeq(b.userId, session.userId)),
  });
  if (!bucket) return { ok: false, error: "Bucket not found" };

  const [maxRow] = await db
    .select({ max: sql<number>`COALESCE(MAX(${items.sortOrder}), -1)` })
    .from(items)
    .where(eq(items.bucketId, bucketId));

  const ctx = await reminderContext(bucketId);
  const parsedDeadline = deadline ? parseLocalDateTime(deadline, ctx.timezone) : null;
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
  properties?: Record<string, unknown> | null
): Promise<ActionResult> {
  const session = await requireSession();

  const trimmed = title.trim();
  if (!trimmed) return { ok: false, error: "Title is required" };
  if (trimmed.length > ITEM_TITLE_MAX_LENGTH) return { ok: false, error: "Title too long" };
  if (recurring && !RecurringConfig.safeParse(recurring).success) {
    return { ok: false, error: "Invalid repeat settings" };
  }

  const item = await db.query.items.findFirst({
    where: (i, { eq: qeq, and: qand }) => qand(qeq(i.id, itemId), qeq(i.userId, session.userId)),
  });
  if (!item) return { ok: false, error: "Item not found" };

  const ctx = await reminderContext(item.bucketId);
  const newDeadline = deadline ? parseLocalDateTime(deadline, ctx.timezone) : null;
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
      ...reminderResetForDeadline(item, newDeadline, ctx),
      ...(status !== undefined && { status }),
      ...(nowCompleted && { completedAt: new Date() }),
      ...(nowUncompleted && { completedAt: null }),
      ...(recurring !== undefined && {
        recurring: recurring?.enabled
          ? JSON.stringify(keepAnchor(recurring, item.recurring))
          : null,
      }),
      ...(properties !== undefined && {
        properties: properties ? JSON.stringify(properties) : null,
      }),
      updatedAt: new Date(),
    })
    .where(and(eq(items.id, itemId), eq(items.userId, session.userId)));
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

export async function completeItemAction(itemId: number): Promise<ActionResult> {
  const session = await requireSession();

  const item = await db.query.items.findFirst({
    where: (i, { eq: qeq, and: qand }) => qand(qeq(i.id, itemId), qeq(i.userId, session.userId)),
  });
  if (!item) return { ok: false, error: "Item not found" };

  const newStatus =
    item.status === ITEM_STATUS.completed ? ITEM_STATUS.active : ITEM_STATUS.completed;
  await db
    .update(items)
    .set({
      status: newStatus,
      completedAt: newStatus === ITEM_STATUS.completed ? new Date() : null,
      ...(newStatus === ITEM_STATUS.active && { overdueNotifiedAt: null }),
      updatedAt: new Date(),
    })
    .where(and(eq(items.id, itemId), eq(items.userId, session.userId)));
  await refreshItemReminders([itemId]);
  if (newStatus === ITEM_STATUS.completed) await createNextOccurrence(itemId);

  revalidatePath("/");
  return { ok: true };
}

export async function reorderItemsAction(
  bucketId: number,
  orderedIds: number[]
): Promise<ActionResult> {
  const session = await requireSession();

  const bucket = await db.query.buckets.findFirst({
    where: (b, { eq: qeq, and: qand }) => qand(qeq(b.id, bucketId), qeq(b.userId, session.userId)),
  });
  if (!bucket) return { ok: false, error: "Bucket not found" };

  await Promise.all(
    orderedIds.map((id, i) =>
      db
        .update(items)
        .set({ sortOrder: i })
        .where(and(eq(items.id, id), eq(items.userId, session.userId)))
    )
  );

  revalidatePath("/");
  return { ok: true };
}

export async function deleteItemAction(itemId: number): Promise<ActionResult> {
  const session = await requireSession();

  const item = await db.query.items.findFirst({
    where: (i, { eq: qeq, and: qand }) => qand(qeq(i.id, itemId), qeq(i.userId, session.userId)),
  });
  if (!item) return { ok: false, error: "Item not found" };

  await db
    .update(items)
    .set({ deletedAt: new Date() })
    .where(and(eq(items.id, itemId), eq(items.userId, session.userId)));
  await refreshItemReminders([itemId]);

  revalidatePath("/");
  return { ok: true };
}

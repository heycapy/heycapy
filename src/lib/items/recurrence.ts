import type { ActionResult } from "@/types/result";
import type { RecurringConfig } from "@/types/rules";
import { CLOSED_ITEM_STATUSES, ITEM_STATUS } from "@/constants";
import { and, eq, isNotNull, isNull, lt, notInArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, items } from "@/lib/db/schema";
import { dataEvents } from "@/lib/events";
import { parseItemsRules } from "@/lib/rules";
import {
  refreshItemReminders,
  reminderContext,
  type ReminderContext,
} from "@/lib/reminders/refresh";
import { reminderResetForDeadline } from "./reminders";
import {
  followingOccurrence,
  nextAfterCompletion,
  nextOccurrenceDate,
  parseRecurring,
  withAnchor,
} from "./occurrence";

type Item = typeof items.$inferSelect;

async function recurrenceModeOf(bucketId: number) {
  const bucket = await db.query.buckets.findFirst({
    where: eq(buckets.id, bucketId),
    columns: { itemsRules: true },
  });
  return parseItemsRules(bucket?.itemsRules).recurrenceMode ?? "wait";
}

async function insertOccurrence(
  from: Item & { deadline: Date },
  deadline: Date,
  config: RecurringConfig,
  ctx: ReminderContext
): Promise<void> {
  const [next] = await db
    .insert(items)
    .values({
      bucketId: from.bucketId,
      userId: from.userId,
      title: from.title,
      description: from.description,
      properties: from.properties,
      deadline,
      notificationOffsetMins: from.notificationOffsetMins,
      recurring: JSON.stringify(withAnchor(config, from.deadline, ctx.timezone)),
      source: from.source,
    })
    .returning({ id: items.id });
  if (next) await refreshItemReminders([next.id]);
}

export async function createNextOccurrence(itemId: number, now = new Date()): Promise<void> {
  const completed = await db.query.items.findFirst({ where: eq(items.id, itemId) });
  if (completed?.status !== ITEM_STATUS.completed || !completed.recurring || !completed.deadline)
    return;

  const config = parseRecurring(completed.recurring);
  const ctx = await reminderContext(completed.bucketId);
  const mode = await recurrenceModeOf(completed.bucketId);
  const deadline =
    config &&
    (mode === "afterCompletion"
      ? nextAfterCompletion(completed.deadline, config, ctx.timezone, completed.completedAt ?? now)
      : nextOccurrenceDate(completed.deadline, config, ctx.timezone, now));
  if (!config || !deadline) return;

  // Atomic: only the first completion creates the next occurrence
  const [claimed] = await db
    .update(items)
    .set({ recurring: null })
    .where(and(eq(items.id, itemId), eq(items.recurring, completed.recurring)))
    .returning({ id: items.id });
  if (!claimed) return;

  await insertOccurrence({ ...completed, deadline: completed.deadline }, deadline, config, ctx);
}

// "Move on if missed": once the next date arrives, an unfinished occurrence is closed as missed
export async function moveOnMissedOccurrences(now = new Date()): Promise<void> {
  const candidates = await db
    .select({ item: items, itemsRules: buckets.itemsRules })
    .from(items)
    .innerJoin(buckets, eq(buckets.id, items.bucketId))
    .where(
      and(
        isNotNull(items.recurring),
        isNull(items.deletedAt),
        notInArray(items.status, [...CLOSED_ITEM_STATUSES, ITEM_STATUS.onHold]),
        lt(items.deadline, now)
      )
    );

  for (const { item, itemsRules } of candidates) {
    if (parseItemsRules(itemsRules).recurrenceMode !== "moveOn") continue;
    const config = parseRecurring(item.recurring);
    if (!config || !item.deadline) continue;
    const ctx = await reminderContext(item.bucketId);

    // The latest occurrence that has already arrived becomes the current one
    let current = followingOccurrence(item.deadline, config, ctx.timezone);
    if (!current || current > now) continue;
    for (;;) {
      const after = followingOccurrence(current, config, ctx.timezone);
      if (!after || after > now) break;
      current = after;
    }

    const [claimed] = await db
      .update(items)
      .set({ status: ITEM_STATUS.missed, recurring: null, updatedAt: now })
      .where(
        and(
          eq(items.id, item.id),
          eq(items.recurring, item.recurring ?? ""),
          notInArray(items.status, CLOSED_ITEM_STATUSES as string[])
        )
      )
      .returning({ id: items.id });
    if (!claimed) continue;

    await refreshItemReminders([item.id]);
    await insertOccurrence({ ...item, deadline: item.deadline }, current, config, ctx);
    dataEvents.emit("refresh", item.userId);
  }
}

export async function skipOccurrence(
  userId: number,
  itemId: number,
  now = new Date()
): Promise<ActionResult> {
  const item = await db.query.items.findFirst({
    where: and(eq(items.id, itemId), eq(items.userId, userId)),
  });
  if (!item) return { ok: false, error: "Item not found" };
  const config = parseRecurring(item.recurring);
  if (CLOSED_ITEM_STATUSES.includes(item.status) || !item.deadline || !config?.enabled) {
    return { ok: false, error: "Only an open repeating item with a date can be skipped" };
  }

  const ctx = await reminderContext(item.bucketId);
  const deadline = nextOccurrenceDate(item.deadline, config, ctx.timezone, now);
  if (!deadline) {
    return { ok: false, error: "This is the last occurrence — complete or delete it instead" };
  }

  await db
    .update(items)
    .set({
      deadline,
      recurring: JSON.stringify(withAnchor(config, item.deadline, ctx.timezone)),
      ...reminderResetForDeadline(item, deadline, ctx, now),
      updatedAt: now,
    })
    .where(eq(items.id, itemId));
  await refreshItemReminders([itemId]);
  return { ok: true };
}

import type { ItemId } from "@/types/ids";
import type { ActionResult } from "@/types/result";
import type { RecurringConfig } from "@/types/rules";
import { CLOSED_ITEM_STATUSES, ITEM_STATUS } from "@/constants";
import { and, eq, isNotNull, isNull, lt, notInArray } from "drizzle-orm";
import type { DbHandle } from "@/lib/db/handle";
import { buckets, items } from "@/lib/db/schema";
import { findAccessibleItem } from "@/lib/buckets/access";
import { dataEvents } from "@/lib/events";
import { parseItemsRules } from "@/lib/rules";
import {
  lastNotifiedAt,
  refreshItemReminders,
  reminderContext,
  type ReminderContext,
} from "@/lib/reminders/refresh";
import { reminderResetForDeadline } from "./reminders";
import { copyAssignees } from "./assignees";
import { onClock } from "./deadline";
import {
  followingOccurrence,
  nextAfterCompletion,
  nextInSeries,
  nextOccurrenceDate,
  parseRecurring,
  seriesDate,
  withAnchor,
} from "./occurrence";

type Item = typeof items.$inferSelect;

// A series repeats on the clock its date was set on
function seriesZone(item: Item, ctx: ReminderContext): string {
  return item.deadlineTimezone ?? ctx.timezone;
}

function recurrenceModeOf(h: DbHandle, bucketId: number) {
  const bucket = h.query.buckets
    .findFirst({
      where: eq(buckets.id, bucketId),
      columns: { itemsRules: true },
    })
    .sync();
  return parseItemsRules(bucket?.itemsRules).recurrenceMode ?? "wait";
}

function insertOccurrence(
  h: DbHandle,
  from: Item & { deadline: Date },
  deadline: Date,
  config: RecurringConfig,
  ctx: ReminderContext
): void {
  const [next] = h
    .insert(items)
    .values({
      bucketId: from.bucketId,
      userId: from.userId,
      title: from.title,
      description: from.description,
      properties: from.properties,
      deadline,
      deadlineTimezone: seriesZone(from, ctx),
      reminderOffsets: from.reminderOffsets,
      recurring: JSON.stringify(withAnchor(config, seriesDate(from), seriesZone(from, ctx))),
      source: from.source,
    })
    .returning({ id: items.id })
    .all();
  if (!next) return;
  copyAssignees(h, from.id, next.id);
  refreshItemReminders(h, [next.id]);
}

export function createNextOccurrence(h: DbHandle, itemId: ItemId, now = new Date()): void {
  const completed = h.query.items.findFirst({ where: eq(items.id, itemId) }).sync();
  if (completed?.status !== ITEM_STATUS.completed || !completed.recurring || !completed.deadline)
    return;

  const config = parseRecurring(completed.recurring);
  const ctx = reminderContext(h, completed.bucketId);
  const timezone = seriesZone(completed, ctx);
  const mode = recurrenceModeOf(h, completed.bucketId);
  const occurrence = { deadline: completed.deadline, scheduledAt: completed.scheduledAt };
  const deadline =
    config &&
    (mode === "afterCompletion"
      ? nextAfterCompletion(seriesDate(occurrence), config, timezone, completed.completedAt ?? now)
      : nextInSeries(occurrence, config, timezone, now));
  if (!config || !deadline) return;

  // Atomic: only the first completion creates the next occurrence
  const [claimed] = h
    .update(items)
    .set({ recurring: null })
    .where(and(eq(items.id, itemId), eq(items.recurring, completed.recurring)))
    .returning({ id: items.id })
    .all();
  if (!claimed) return;

  insertOccurrence(h, { ...completed, deadline: completed.deadline }, deadline, config, ctx);
}

// "Move on if missed": once the next date arrives, an unfinished occurrence is closed as missed
export function moveOnMissedOccurrences(h: DbHandle, now = new Date()): void {
  const candidates = h
    .select({ item: items, itemsRules: buckets.itemsRules })
    .from(items)
    .innerJoin(buckets, eq(buckets.id, items.bucketId))
    .where(
      and(
        isNotNull(items.recurring),
        isNull(items.deletedAt),
        notInArray(items.status, CLOSED_ITEM_STATUSES as string[]),
        lt(items.deadline, now)
      )
    )
    .all();

  for (const { item, itemsRules } of candidates) {
    if (parseItemsRules(itemsRules).recurrenceMode !== "moveOn") continue;
    const config = parseRecurring(item.recurring);
    if (!config || !item.deadline) continue;
    const ctx = reminderContext(h, item.bucketId);
    const timezone = seriesZone(item, ctx);

    // The latest occurrence that has already arrived becomes the current one
    const occurrence = { deadline: item.deadline, scheduledAt: item.scheduledAt };
    let current = nextOccurrenceDate(seriesDate(occurrence), config, timezone, item.deadline);
    if (!current || current > now) continue;
    for (;;) {
      const after = followingOccurrence(current, config, timezone);
      if (!after || after > now) break;
      current = after;
    }

    const [claimed] = h
      .update(items)
      .set({ status: ITEM_STATUS.missed, recurring: null, updatedAt: now })
      .where(
        and(
          eq(items.id, item.id),
          eq(items.recurring, item.recurring ?? ""),
          notInArray(items.status, CLOSED_ITEM_STATUSES as string[])
        )
      )
      .returning({ id: items.id })
      .all();
    if (!claimed) continue;

    refreshItemReminders(h, [item.id]);
    insertOccurrence(h, { ...item, deadline: item.deadline }, current, config, ctx);
    dataEvents.emit("refresh", item.userId);
  }
}

export function skipOccurrence(
  h: DbHandle,
  userId: number,
  itemId: ItemId,
  now = new Date()
): ActionResult {
  return h.transaction((tx) => {
    const item = findAccessibleItem(tx, userId, itemId);
    if (!item) return { ok: false, error: "Item not found" };
    const config = parseRecurring(item.recurring);
    if (CLOSED_ITEM_STATUSES.includes(item.status) || !item.deadline || !config?.enabled) {
      return { ok: false, error: "Only an open repeating item with a date can be skipped" };
    }

    const ctx = reminderContext(tx, item.bucketId);
    const timezone = seriesZone(item, ctx);
    const occurrence = { deadline: item.deadline, scheduledAt: item.scheduledAt };
    const deadline = nextInSeries(occurrence, config, timezone, now);
    if (!deadline) {
      return { ok: false, error: "This is the last occurrence — complete or delete it instead" };
    }

    tx.update(items)
      .set({
        deadline,
        deadlineTimezone: timezone,
        scheduledAt: null,
        recurring: JSON.stringify(withAnchor(config, seriesDate(occurrence), timezone)),
        ...reminderResetForDeadline(
          { ...item, notifiedAt: lastNotifiedAt(tx, item.id) },
          deadline,
          ctx,
          now,
          timezone
        ),
        updatedAt: now,
      })
      .where(eq(items.id, itemId))
      .run();
    refreshItemReminders(tx, [itemId]);
    return { ok: true };
  });
}

export function moveOccurrence(
  h: DbHandle,
  userId: number,
  itemId: ItemId,
  askedDeadline: Date,
  now = new Date(),
  askedTimezone?: string
): ActionResult<{ next: Date | null }> {
  return h.transaction((tx) => {
    const item = findAccessibleItem(tx, userId, itemId);
    if (!item) return { ok: false, error: "Item not found" };

    const config = parseRecurring(item.recurring);
    const scheduled = config?.enabled && item.deadline ? (item.scheduledAt ?? item.deadline) : null;
    const ctx = reminderContext(tx, item.bucketId);
    const timezone = seriesZone(item, ctx);
    const asked = { deadline: askedDeadline, deadlineTimezone: askedTimezone ?? timezone };
    // Moving one occurrence keeps the series on its own clock
    const due = scheduled ? onClock(asked, timezone) : asked;
    const { deadline } = due;

    tx.update(items)
      .set({
        deadline,
        deadlineTimezone: due.deadlineTimezone,
        scheduledAt: scheduled && scheduled.getTime() !== deadline.getTime() ? scheduled : null,
        ...reminderResetForDeadline(
          { ...item, notifiedAt: lastNotifiedAt(tx, item.id) },
          deadline,
          ctx,
          now,
          due.deadlineTimezone
        ),
        updatedAt: now,
      })
      .where(eq(items.id, itemId))
      .run();
    refreshItemReminders(tx, [itemId]);

    const mode = scheduled ? recurrenceModeOf(tx, item.bucketId) : null;
    const next =
      config && scheduled && mode !== "afterCompletion"
        ? nextInSeries({ deadline, scheduledAt: scheduled }, config, timezone, now)
        : null;
    return { ok: true, next };
  });
}

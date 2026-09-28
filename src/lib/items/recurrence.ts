import type { ActionResult } from "@/types/result";
import { ITEM_STATUS } from "@/constants";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { refreshItemReminders, reminderContext } from "@/lib/reminders/refresh";
import { reminderResetForDeadline } from "./reminders";
import { nextOccurrenceDate, parseRecurring, withAnchor } from "./occurrence";

export async function createNextOccurrence(itemId: number, now = new Date()): Promise<void> {
  const completed = await db.query.items.findFirst({ where: eq(items.id, itemId) });
  if (completed?.status !== ITEM_STATUS.completed || !completed.recurring || !completed.deadline)
    return;

  const config = parseRecurring(completed.recurring);
  const ctx = await reminderContext(completed.bucketId);
  const deadline = config && nextOccurrenceDate(completed.deadline, config, ctx.timezone, now);
  if (!config || !deadline) return;

  // Atomic: only the first completion creates the next occurrence
  const [claimed] = await db
    .update(items)
    .set({ recurring: null })
    .where(and(eq(items.id, itemId), eq(items.recurring, completed.recurring)))
    .returning({ id: items.id });
  if (!claimed) return;

  const [next] = await db
    .insert(items)
    .values({
      bucketId: completed.bucketId,
      userId: completed.userId,
      title: completed.title,
      description: completed.description,
      properties: completed.properties,
      deadline,
      notificationOffsetMins: completed.notificationOffsetMins,
      recurring: JSON.stringify(withAnchor(config, completed.deadline, ctx.timezone)),
      source: completed.source,
    })
    .returning({ id: items.id });
  if (next) await refreshItemReminders([next.id]);
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
  if (item.status === ITEM_STATUS.completed || !item.deadline || !config?.enabled) {
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

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { refreshItemReminders } from "@/lib/reminders/refresh";
import { reminderResetForDeadline } from "./reminders";
import { nextOccurrenceDate, parseRecurring } from "./occurrence";

export async function createNextOccurrence(itemId: number, now = new Date()): Promise<void> {
  const completed = await db.query.items.findFirst({ where: eq(items.id, itemId) });
  if (completed?.status !== "completed" || !completed.recurring || !completed.deadline) return;

  const config = parseRecurring(completed.recurring);
  const deadline = config && nextOccurrenceDate(completed.deadline, config, now);
  if (!deadline) return;

  // Moving the rule off the completed item only succeeds once, so a second completion can't duplicate
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
      recurring: completed.recurring,
      source: completed.source,
    })
    .returning({ id: items.id });
  if (next) await refreshItemReminders([next.id]);
}

export async function skipOccurrence(
  userId: number,
  itemId: number,
  now = new Date()
): Promise<{ ok: true } | { ok: false; error: string }> {
  const item = await db.query.items.findFirst({
    where: and(eq(items.id, itemId), eq(items.userId, userId)),
  });
  if (!item) return { ok: false, error: "Item not found" };
  const config = parseRecurring(item.recurring);
  if (item.status === "completed" || !item.deadline || !config?.enabled) {
    return { ok: false, error: "Only an open repeating item with a date can be skipped" };
  }

  const deadline = nextOccurrenceDate(item.deadline, config, now);
  if (!deadline) {
    return { ok: false, error: "This is the last occurrence — complete or delete it instead" };
  }

  await db
    .update(items)
    .set({ deadline, ...reminderResetForDeadline(item, deadline, now), updatedAt: now })
    .where(eq(items.id, itemId));
  await refreshItemReminders([itemId]);
  return { ok: true };
}

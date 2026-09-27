import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { RecurringConfig } from "@/types/rules";
import { refreshItemReminders } from "@/lib/reminders/refresh";

function advance(deadline: Date, config: RecurringConfig): Date {
  const next = new Date(deadline);
  const n = config.interval;
  switch (config.frequency) {
    case "daily":
      next.setDate(next.getDate() + n);
      break;
    case "weekly":
      next.setDate(next.getDate() + n * 7);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + n);
      break;
    case "yearly":
      next.setFullYear(next.getFullYear() + n);
      break;
  }
  return next;
}

export async function createNextOccurrence(itemId: number, now = new Date()): Promise<void> {
  const completed = await db.query.items.findFirst({ where: eq(items.id, itemId) });
  if (completed?.status !== "completed" || !completed.recurring || !completed.deadline) return;

  let raw: unknown;
  try {
    raw = JSON.parse(completed.recurring);
  } catch {
    return;
  }
  const parsed = RecurringConfig.safeParse(raw);
  if (!parsed.success || !parsed.data.enabled) return;
  const config = parsed.data;

  let deadline = advance(completed.deadline, config);
  while (deadline <= now) deadline = advance(deadline, config);
  if (config.endDate && deadline > new Date(config.endDate)) return;

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

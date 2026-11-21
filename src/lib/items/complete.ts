import { eq } from "drizzle-orm";
import type { DbHandle } from "@/lib/db/handle";
import { items } from "@/lib/db/schema";
import { ITEM_STATUS } from "@/constants";
import { refreshItemReminders } from "@/lib/reminders/refresh";
import { initialReminderState } from "./reminders";
import { createNextOccurrence } from "./recurrence";

type Item = typeof items.$inferSelect;

// Reopening an item whose date has passed sends only the overdue alert, like adding one would
export function toggleItemCompleted(
  h: DbHandle,
  item: Item,
  userId: number,
  now = new Date()
): string {
  const reopening = item.status === ITEM_STATUS.completed;
  const reminders = reopening
    ? {
        overdueNotifiedAt: null,
        ...initialReminderState(item.deadline, item.deadlineTimezone ?? "UTC", now),
      }
    : {};
  const status = reopening ? ITEM_STATUS.active : ITEM_STATUS.completed;
  h.update(items)
    .set({
      status,
      completedAt: reopening ? null : now,
      completedBy: reopening ? null : userId,
      ...reminders,
      updatedAt: now,
    })
    .where(eq(items.id, item.id))
    .run();
  refreshItemReminders(h, [item.id]);
  if (!reopening) createNextOccurrence(h, item.id);
  return status;
}

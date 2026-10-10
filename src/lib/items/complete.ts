import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { ITEM_STATUS } from "@/constants";
import { refreshItemReminders } from "@/lib/reminders/refresh";
import { initialReminderState } from "./reminders";
import { createNextOccurrence } from "./recurrence";

type Item = typeof items.$inferSelect;

// Reopening an item whose date has passed sends only the overdue alert, like adding one would
export async function toggleItemCompleted(item: Item, now = new Date()): Promise<string> {
  const reopening = item.status === ITEM_STATUS.completed;
  const reminders = reopening
    ? {
        overdueNotifiedAt: null,
        ...initialReminderState(item.deadline, item.deadlineTimezone ?? "UTC", now),
      }
    : {};
  const status = reopening ? ITEM_STATUS.active : ITEM_STATUS.completed;
  await db
    .update(items)
    .set({ status, completedAt: reopening ? null : now, ...reminders, updatedAt: now })
    .where(eq(items.id, item.id));
  await refreshItemReminders([item.id]);
  if (!reopening) await createNextOccurrence(item.id);
  return status;
}

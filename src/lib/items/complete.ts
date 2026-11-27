import { eq } from "drizzle-orm";
import type { ItemId } from "@/types/ids";
import type { DbHandle } from "@/lib/db/handle";
import { items } from "@/lib/db/schema";
import { ITEM_STATUS } from "@/constants";
import { findAccessibleItem } from "@/lib/buckets/access";
import { refreshItemReminders } from "@/lib/reminders/refresh";
import { initialReminderState } from "./reminders";
import { createNextOccurrence } from "./recurrence";

// Reopening an item whose date has passed sends only the overdue alert, like adding one would.
// Returns the new status, or null when the person can't reach the item
export function toggleItemCompleted(
  h: DbHandle,
  userId: number,
  itemId: ItemId,
  now = new Date()
): string | null {
  return h.transaction((tx) => {
    const item = findAccessibleItem(tx, userId, itemId);
    if (!item) return null;
    const reopening = item.status === ITEM_STATUS.completed;
    const reminders = reopening
      ? {
          overdueNotifiedAt: null,
          ...initialReminderState(item.deadline, item.deadlineTimezone ?? "UTC", now),
        }
      : {};
    const status = reopening ? ITEM_STATUS.active : ITEM_STATUS.completed;
    tx.update(items)
      .set({
        status,
        completedAt: reopening ? null : now,
        completedBy: reopening ? null : userId,
        ...reminders,
        updatedAt: now,
      })
      .where(eq(items.id, itemId))
      .run();
    refreshItemReminders(tx, [itemId]);
    if (!reopening) createNextOccurrence(tx, itemId);
    return status;
  });
}

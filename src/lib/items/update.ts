import { eq } from "drizzle-orm";
import type { ItemId } from "@/types/ids";
import type { ActionResult } from "@/types/result";
import { RecurringConfig, ReminderOffsets } from "@/types/rules";
import type { DbHandle } from "@/lib/db/handle";
import { items } from "@/lib/db/schema";
import {
  INVALID_STATUS_ERROR,
  ITEM_DESCRIPTION_MAX_LENGTH,
  ITEM_GONE_ERROR,
  ITEM_STATUS,
  ITEM_TITLE_MAX_LENGTH,
  NOT_A_MEMBER_ERROR,
  SETTABLE_ITEM_STATUSES,
  UNKNOWN_CLOCK_ERROR,
} from "@/constants";
import { findAccessibleItem } from "@/lib/buckets/access";
import { isKnownTimezone } from "@/lib/timezones/valid";
import {
  lastNotifiedAt,
  refreshItemReminders,
  reminderContext,
  userTimezone,
} from "@/lib/reminders/refresh";
import { allAreMembers, setItemAssignees } from "./assignees";
import type { ItemPatch } from "./edit-draft";
import { patchedDeadline, patchedRecurring } from "./patch-rules";
import { createNextOccurrence } from "./recurrence";
import { reminderResetForDeadline } from "./reminders";

export function updateItem(
  h: DbHandle,
  userId: number,
  itemId: ItemId,
  patch: ItemPatch,
  now = new Date()
): ActionResult {
  const {
    title,
    description,
    deadline,
    status,
    recurring,
    properties,
    reminders,
    assigneeIds,
    clock,
  } = patch;

  const trimmed = title?.trim();
  if (trimmed !== undefined && !trimmed) return { ok: false, error: "Title is required" };
  if (trimmed && trimmed.length > ITEM_TITLE_MAX_LENGTH) {
    return { ok: false, error: "Title too long" };
  }
  if (description && description.length > ITEM_DESCRIPTION_MAX_LENGTH) {
    return { ok: false, error: "Notes too long" };
  }
  if (recurring && !RecurringConfig.safeParse(recurring).success) {
    return { ok: false, error: "Invalid repeat settings" };
  }
  const parsedReminders = reminders ? ReminderOffsets.safeParse(reminders) : null;
  if (parsedReminders && !parsedReminders.success) {
    return { ok: false, error: "Invalid reminders" };
  }
  if (clock && !isKnownTimezone(clock)) return { ok: false, error: UNKNOWN_CLOCK_ERROR };

  return h.transaction((tx) => {
    const item = findAccessibleItem(tx, userId, itemId);
    if (!item) return { ok: false, error: ITEM_GONE_ERROR };
    // a missed item's editor sends "missed" back unchanged
    if (
      status !== undefined &&
      status !== item.status &&
      !SETTABLE_ITEM_STATUSES.includes(status)
    ) {
      return { ok: false, error: INVALID_STATUS_ERROR };
    }
    if (assigneeIds && !allAreMembers(tx, item.bucketId, assigneeIds)) {
      return { ok: false, error: NOT_A_MEMBER_ERROR };
    }

    const savedRecurring = patchedRecurring(recurring, item.recurring);

    let deadlineChange = {};
    if (deadline !== undefined) {
      const ctx = reminderContext(tx, item.bucketId);
      const {
        deadline: newDeadline,
        deadlineTimezone,
        keepsMovedDate,
      } = patchedDeadline(item, deadline, clock ?? userTimezone(tx, userId), savedRecurring);
      deadlineChange = {
        deadline: newDeadline,
        deadlineTimezone,
        ...(!keepsMovedDate && { scheduledAt: null }),
        ...reminderResetForDeadline(
          { ...item, notifiedAt: lastNotifiedAt(tx, item.id) },
          newDeadline,
          ctx,
          now,
          deadlineTimezone ?? undefined
        ),
      };
    }
    const statusChanged = status !== undefined && status !== item.status;

    const nowCompleted =
      statusChanged && status === ITEM_STATUS.completed && item.status !== ITEM_STATUS.completed;
    const nowUncompleted =
      statusChanged && status !== ITEM_STATUS.completed && item.status === ITEM_STATUS.completed;

    tx.update(items)
      .set({
        ...(trimmed !== undefined && { title: trimmed }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...deadlineChange,
        ...(status !== undefined && { status }),
        ...(nowCompleted && { completedAt: now, completedBy: userId }),
        ...(nowUncompleted && { completedAt: null, completedBy: null }),
        ...(recurring !== undefined && {
          recurring: savedRecurring ? JSON.stringify(savedRecurring) : null,
        }),
        ...(properties !== undefined && {
          properties: properties ? JSON.stringify(properties) : null,
        }),
        ...(reminders !== undefined && { reminderOffsets: parsedReminders?.data ?? null }),
        updatedAt: now,
      })
      .where(eq(items.id, itemId))
      .run();
    if (assigneeIds) setItemAssignees(tx, itemId, assigneeIds);
    refreshItemReminders(tx, [itemId]);
    if (nowCompleted) createNextOccurrence(tx, itemId);
    return { ok: true };
  });
}

import { eq, sql } from "drizzle-orm";
import type { ItemId } from "@/types/ids";
import type { ActionResult } from "@/types/result";
import { RecurringConfig, ReminderOffsets } from "@/types/rules";
import type { DbHandle } from "@/lib/db/handle";
import { items } from "@/lib/db/schema";
import {
  INVALID_STATUS_ERROR,
  ITEM_DESCRIPTION_MAX_LENGTH,
  ITEM_STATUS,
  ITEM_TITLE_MAX_LENGTH,
  NOT_A_MEMBER_ERROR,
  SETTABLE_ITEM_STATUSES,
  UNKNOWN_CLOCK_ERROR,
} from "@/constants";
import { findAccessibleBucket } from "@/lib/buckets/access";
import { isKnownTimezone } from "@/lib/timezones/valid";
import { refreshItemReminders, userTimezone } from "@/lib/reminders/refresh";
import { allAreMembers, assignEveryone, setItemAssignees } from "./assignees";
import { resolveDeadline } from "./deadline";
import { onLastDayIfAnchored } from "./occurrence";
import { initialReminderState } from "./reminders";

export type NewItem = {
  id?: ItemId;
  bucketId: number;
  title: string;
  deadline: string | null;
  status?: string;
  recurring?: RecurringConfig | null;
  properties?: Record<string, unknown> | null;
  reminders?: number[] | null;
  assigneeIds?: number[];
  clock?: string | null;
  description?: string;
};

export function addItem(
  h: DbHandle,
  userId: number,
  input: NewItem,
  now = new Date()
): ActionResult<{ id: ItemId }> {
  const { bucketId, deadline, status, recurring, properties, reminders, assigneeIds, clock } =
    input;
  const { description } = input;

  const title = input.title.trim();
  if (!title) return { ok: false, error: "Title is required" };
  if (title.length > ITEM_TITLE_MAX_LENGTH) return { ok: false, error: "Title too long" };
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
  if (status !== undefined && !SETTABLE_ITEM_STATUSES.includes(status)) {
    return { ok: false, error: INVALID_STATUS_ERROR };
  }

  return h.transaction((tx) => {
    if (!findAccessibleBucket(tx, userId, bucketId)) {
      return { ok: false, error: "Bucket not found" };
    }
    if (assigneeIds && !allAreMembers(tx, bucketId, assigneeIds)) {
      return { ok: false, error: NOT_A_MEMBER_ERROR };
    }

    const maxRow = tx
      .select({ max: sql<number>`COALESCE(MAX(${items.sortOrder}), -1)` })
      .from(items)
      .where(eq(items.bucketId, bucketId))
      .get();

    const due = resolveDeadline(deadline, clock ?? userTimezone(tx, userId));
    const parsedDeadline =
      due.deadline && due.deadlineTimezone
        ? onLastDayIfAnchored(due.deadline, recurring ?? null, due.deadlineTimezone)
        : null;
    const created = tx
      .insert(items)
      .values({
        ...(input.id && { id: input.id }),
        bucketId,
        userId,
        title,
        description: description?.trim() || null,
        deadline: parsedDeadline,
        deadlineTimezone: due.deadlineTimezone,
        ...initialReminderState(parsedDeadline, due.deadlineTimezone ?? "UTC", now),
        status: status ?? ITEM_STATUS.active,
        ...(status === ITEM_STATUS.completed && { completedAt: now, completedBy: userId }),
        sortOrder: (maxRow?.max ?? -1) + 1,
        recurring: recurring?.enabled ? JSON.stringify(recurring) : null,
        properties: properties ? JSON.stringify(properties) : null,
        reminderOffsets: parsedReminders?.data ?? null,
      })
      .returning({ id: items.id })
      .get();
    if (assigneeIds) setItemAssignees(tx, created.id, assigneeIds);
    else assignEveryone(tx, created.id, bucketId);
    refreshItemReminders(tx, [created.id]);
    return { ok: true, id: created.id };
  });
}

"use server";

import type { ItemId } from "@/types/ids";
import type { ActionResult } from "@/types/result";
import { parseItemsRules } from "@/lib/rules";
import { revalidatePath } from "next/cache";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { requireSession } from "./action-helpers";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { findAccessibleBucket, findAccessibleItem } from "@/lib/buckets/access";
import {
  ITEM_DESCRIPTION_MAX_LENGTH,
  ITEM_GONE_ERROR,
  ITEM_STATUS,
  ITEM_TITLE_MAX_LENGTH,
  SETTABLE_ITEM_STATUSES,
} from "@/constants";
import { RecurringConfig, ReminderOffsets } from "@/types/rules";
import { initialReminderState, reminderResetForDeadline } from "@/lib/items/reminders";
import {
  lastNotifiedAt,
  refreshItemReminders,
  reminderContext,
  userTimezone,
} from "@/lib/reminders/refresh";
import { resolveDeadline } from "@/lib/items/deadline";
import type { ItemPatch } from "@/lib/items/edit-draft";
import { isKnownTimezone } from "@/lib/timezones/valid";
import { createNextOccurrence, moveOccurrence, skipOccurrence } from "@/lib/items/recurrence";
import { onLastDayIfAnchored, parseRecurring } from "@/lib/items/occurrence";
import { cancelRemindAgain } from "@/lib/reminders/quick-actions";
import { allAreMembers, assignEveryone, setItemAssignees } from "@/lib/items/assignees";
import { toggleItemCompleted } from "@/lib/items/complete";
import { deleteItem } from "@/lib/items/delete";
import { bucketsChanged, dataEvents } from "@/lib/events";
import {
  getItemReminderInfo,
  getReminderBadges,
  withViewerReminders,
  type ItemReminderInfo,
  type ListItem,
  type ReminderBadge,
} from "@/lib/reminders/status";

export async function getItemsForBucketAction(bucketId: number): Promise<
  ActionResult<{
    items: ListItem[];
    reminderBadges: Record<ItemId, ReminderBadge>;
  }>
> {
  const session = await requireSession();

  const bucket = findAccessibleBucket(db, session.userId, bucketId);
  if (!bucket) return { ok: false, error: "Bucket not found" };

  const sortBy = parseItemsRules(bucket.itemsRules).sortBy ?? "manual";

  const condition = and(eq(items.bucketId, bucketId), isNull(items.deletedAt));

  const result =
    sortBy === "deadline"
      ? await db
          .select()
          .from(items)
          .where(condition)
          .orderBy(
            sql`${items.deadline} IS NULL`,
            asc(items.deadline),
            asc(items.createdAt),
            asc(items.id)
          )
      : sortBy === "created_at"
        ? await db
            .select()
            .from(items)
            .where(condition)
            .orderBy(asc(items.createdAt), asc(items.id))
        : await db
            .select()
            .from(items)
            .where(condition)
            .orderBy(asc(items.sortOrder), asc(items.createdAt), asc(items.id));

  const viewed = await withViewerReminders(session.userId, result);
  const reminderBadges = await getReminderBadges(session.userId, bucket.id, viewed);
  return { ok: true, items: viewed, reminderBadges };
}

export async function getItemReminderInfoAction(itemId: ItemId): Promise<ItemReminderInfo | null> {
  const session = await requireSession();
  return getItemReminderInfo(session.userId, itemId);
}

export async function cancelRemindAgainAction(itemId: ItemId): Promise<ActionResult> {
  const session = await requireSession();
  if (!(await cancelRemindAgain(session.userId, itemId, "app"))) {
    return { ok: false, error: "nothing to cancel — it may have already gone out" };
  }
  dataEvents.emit("refresh", session.userId);
  revalidatePath("/");
  return { ok: true };
}

const NOT_A_MEMBER_ERROR = "That person isn't in this bucket";
const UNKNOWN_CLOCK_ERROR = "That timezone doesn't exist";
const INVALID_STATUS_ERROR = "Invalid status";

export async function addItemAction(
  bucketId: number,
  title: string,
  deadline: string | null,
  status?: string,
  recurring?: RecurringConfig | null,
  properties?: Record<string, unknown> | null,
  reminders?: number[] | null,
  assigneeIds?: number[],
  clock?: string | null,
  description?: string
): Promise<ActionResult<{ id: ItemId }>> {
  const session = await requireSession();

  const trimmed = title.trim();
  if (!trimmed) return { ok: false, error: "Title is required" };
  if (trimmed.length > ITEM_TITLE_MAX_LENGTH) return { ok: false, error: "Title too long" };
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

  const bucket = findAccessibleBucket(db, session.userId, bucketId);
  if (!bucket) return { ok: false, error: "Bucket not found" };
  if (assigneeIds && !allAreMembers(db, bucketId, assigneeIds)) {
    return { ok: false, error: NOT_A_MEMBER_ERROR };
  }

  const [maxRow] = await db
    .select({ max: sql<number>`COALESCE(MAX(${items.sortOrder}), -1)` })
    .from(items)
    .where(eq(items.bucketId, bucketId));

  const due = resolveDeadline(deadline, clock ?? userTimezone(db, session.userId));
  const parsedDeadline =
    due.deadline && due.deadlineTimezone
      ? onLastDayIfAnchored(due.deadline, recurring ?? null, due.deadlineTimezone)
      : null;
  const [created] = await db
    .insert(items)
    .values({
      bucketId,
      userId: session.userId,
      title: trimmed,
      description: description?.trim() || null,
      deadline: parsedDeadline,
      deadlineTimezone: due.deadlineTimezone,
      ...initialReminderState(parsedDeadline, due.deadlineTimezone ?? "UTC"),
      status: status ?? ITEM_STATUS.active,
      ...(status === ITEM_STATUS.completed && {
        completedAt: new Date(),
        completedBy: session.userId,
      }),
      sortOrder: maxRow.max + 1,
      recurring: recurring?.enabled ? JSON.stringify(recurring) : null,
      properties: properties ? JSON.stringify(properties) : null,
      reminderOffsets: parsedReminders?.data ?? null,
    })
    .returning({ id: items.id });
  if (assigneeIds) setItemAssignees(db, created.id, assigneeIds);
  else assignEveryone(db, created.id, bucketId);
  refreshItemReminders(db, [created.id]);

  revalidatePath("/");
  return { ok: true, id: created.id };
}

// The editor doesn't know the series anchor, keep it while the frequency stays the same
function keepAnchor(config: RecurringConfig, saved: string | null): RecurringConfig {
  if (config.anchorDay) return config;
  const previous = parseRecurring(saved);
  return previous?.frequency === config.frequency && previous.anchorDay
    ? { ...config, anchorDay: previous.anchorDay }
    : config;
}

async function updateItem(itemId: ItemId, patch: ItemPatch): Promise<ActionResult> {
  const session = await requireSession();
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

  const item = findAccessibleItem(db, session.userId, itemId);
  if (!item) return { ok: false, error: ITEM_GONE_ERROR };
  // a missed item's editor sends "missed" back unchanged
  if (status !== undefined && status !== item.status && !SETTABLE_ITEM_STATUSES.includes(status)) {
    return { ok: false, error: INVALID_STATUS_ERROR };
  }
  if (assigneeIds && !allAreMembers(db, item.bucketId, assigneeIds)) {
    return { ok: false, error: NOT_A_MEMBER_ERROR };
  }

  const savedRecurring =
    recurring === undefined
      ? parseRecurring(item.recurring)
      : recurring?.enabled
        ? keepAnchor(recurring, item.recurring)
        : null;

  let deadlineChange = {};
  if (deadline !== undefined) {
    const ctx = reminderContext(db, item.bucketId);
    const due = resolveDeadline(deadline, clock ?? userTimezone(db, session.userId), item);
    const parsedDeadline = due.deadline;
    const keepsMovedDate =
      !!item.scheduledAt &&
      !!savedRecurring &&
      parsedDeadline?.getTime() === item.deadline?.getTime();
    const newDeadline =
      parsedDeadline && due.deadlineTimezone && !keepsMovedDate
        ? onLastDayIfAnchored(parsedDeadline, savedRecurring, due.deadlineTimezone)
        : parsedDeadline;
    deadlineChange = {
      deadline: newDeadline,
      deadlineTimezone: due.deadlineTimezone,
      ...(!keepsMovedDate && { scheduledAt: null }),
      ...reminderResetForDeadline(
        { ...item, notifiedAt: lastNotifiedAt(db, item.id) },
        newDeadline,
        ctx,
        new Date(),
        due.deadlineTimezone ?? undefined
      ),
    };
  }
  const statusChanged = status !== undefined && status !== item.status;

  const nowCompleted =
    statusChanged && status === ITEM_STATUS.completed && item.status !== ITEM_STATUS.completed;
  const nowUncompleted =
    statusChanged && status !== ITEM_STATUS.completed && item.status === ITEM_STATUS.completed;

  await db
    .update(items)
    .set({
      ...(trimmed !== undefined && { title: trimmed }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...deadlineChange,
      ...(status !== undefined && { status }),
      ...(nowCompleted && { completedAt: new Date(), completedBy: session.userId }),
      ...(nowUncompleted && { completedAt: null, completedBy: null }),
      ...(recurring !== undefined && {
        recurring: savedRecurring ? JSON.stringify(savedRecurring) : null,
      }),
      ...(properties !== undefined && {
        properties: properties ? JSON.stringify(properties) : null,
      }),
      ...(reminders !== undefined && { reminderOffsets: parsedReminders?.data ?? null }),
      updatedAt: new Date(),
    })
    .where(eq(items.id, itemId));
  if (assigneeIds) setItemAssignees(db, itemId, assigneeIds);
  refreshItemReminders(db, [itemId]);
  if (nowCompleted) createNextOccurrence(db, itemId);

  revalidatePath("/");
  return { ok: true };
}

export async function patchItemAction(itemId: ItemId, patch: ItemPatch): Promise<ActionResult> {
  return updateItem(itemId, patch);
}

export async function updateItemAction(
  itemId: ItemId,
  title: string,
  deadline: string | null,
  status?: string,
  recurring?: RecurringConfig | null,
  properties?: Record<string, unknown> | null,
  reminders?: number[] | null,
  assigneeIds?: number[],
  clock?: string | null
): Promise<ActionResult> {
  return updateItem(itemId, {
    title,
    deadline,
    status,
    recurring,
    properties,
    reminders,
    assigneeIds,
    clock,
  });
}

export async function skipOccurrenceAction(itemId: ItemId): Promise<ActionResult> {
  const session = await requireSession();
  const result = skipOccurrence(db, session.userId, itemId);
  if (result.ok) revalidatePath("/");
  return result;
}

export async function moveItemAction(itemId: ItemId, deadline: string): Promise<ActionResult> {
  const session = await requireSession();

  const item = findAccessibleItem(db, session.userId, itemId);
  if (!item) return { ok: false, error: ITEM_GONE_ERROR };

  const due = resolveDeadline(deadline, userTimezone(db, session.userId), item);
  if (!due.deadline || isNaN(due.deadline.getTime())) return { ok: false, error: "Invalid date" };

  const result = moveOccurrence(
    db,
    session.userId,
    itemId,
    due.deadline,
    new Date(),
    due.deadlineTimezone ?? undefined
  );
  if (!result.ok) return result;
  revalidatePath("/");
  return { ok: true };
}

export async function assignItemAction(
  itemId: ItemId,
  assigneeIds: number[]
): Promise<ActionResult> {
  const session = await requireSession();

  const item = findAccessibleItem(db, session.userId, itemId);
  if (!item) return { ok: false, error: ITEM_GONE_ERROR };
  if (!allAreMembers(db, item.bucketId, assigneeIds)) {
    return { ok: false, error: NOT_A_MEMBER_ERROR };
  }

  setItemAssignees(db, itemId, assigneeIds);
  await db.update(items).set({ updatedAt: new Date() }).where(eq(items.id, itemId));
  refreshItemReminders(db, [itemId]);

  revalidatePath("/");
  return { ok: true };
}

export async function completeItemAction(itemId: ItemId): Promise<ActionResult> {
  const session = await requireSession();

  if (!toggleItemCompleted(db, session.userId, itemId)) {
    return { ok: false, error: ITEM_GONE_ERROR };
  }

  revalidatePath("/");
  return { ok: true };
}

export async function reorderItemsAction(
  bucketId: number,
  orderedIds: ItemId[]
): Promise<ActionResult> {
  const session = await requireSession();

  const bucket = findAccessibleBucket(db, session.userId, bucketId);
  if (!bucket) return { ok: false, error: "Bucket not found" };

  await Promise.all(
    orderedIds.map((id, i) =>
      db
        .update(items)
        .set({ sortOrder: i })
        .where(and(eq(items.id, id), eq(items.bucketId, bucketId)))
    )
  );
  bucketsChanged([bucketId]);

  revalidatePath("/");
  return { ok: true };
}

export async function deleteItemAction(itemId: ItemId): Promise<ActionResult> {
  const session = await requireSession();

  if (!deleteItem(db, session.userId, itemId)) return { ok: false, error: ITEM_GONE_ERROR };

  revalidatePath("/");
  return { ok: true };
}

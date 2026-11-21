"use server";

import type { ItemId } from "@/types/ids";
import type { ActionResult } from "@/types/result";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { requireSession } from "./action-helpers";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { findAccessibleBucket } from "@/lib/buckets/access";
import { ITEM_GONE_ERROR } from "@/constants";
import type { RecurringConfig } from "@/types/rules";
import type { ItemPatch } from "@/lib/items/edit-draft";
import { skipOccurrence } from "@/lib/items/recurrence";
import { reorderItems } from "@/lib/items/reorder";
import { addItem } from "@/lib/items/add";
import { updateItem } from "@/lib/items/update";
import { assignItem } from "@/lib/items/assign";
import { moveItem } from "@/lib/items/move";
import { cancelRemindAgain } from "@/lib/reminders/quick-actions";
import { toggleItemCompleted } from "@/lib/items/complete";
import { deleteItem } from "@/lib/items/delete";
import { dataEvents } from "@/lib/events";
import {
  getItemReminderInfo,
  getReminderBadges,
  withViewerReminders,
  type ItemReminderInfo,
  type ReminderBadge,
} from "@/lib/reminders/status";

// Delivery failures and missing channels live on the server, so the list asks for them apart from
// the items, which it reads from the device
export async function getReminderBadgesAction(
  bucketId: number
): Promise<ActionResult<{ reminderBadges: Record<ItemId, ReminderBadge> }>> {
  const session = await requireSession();

  const bucket = findAccessibleBucket(db, session.userId, bucketId);
  if (!bucket) return { ok: false, error: "Bucket not found" };

  const rows = await db
    .select()
    .from(items)
    .where(and(eq(items.bucketId, bucketId), isNull(items.deletedAt)));
  const viewed = await withViewerReminders(session.userId, rows);
  return { ok: true, reminderBadges: await getReminderBadges(session.userId, bucket.id, viewed) };
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

  const result = addItem(db, session.userId, {
    bucketId,
    title,
    deadline,
    status,
    recurring,
    properties,
    reminders,
    assigneeIds,
    clock,
    description,
  });
  if (result.ok) revalidatePath("/");
  return result;
}

async function updateItemFor(itemId: ItemId, patch: ItemPatch): Promise<ActionResult> {
  const session = await requireSession();
  const result = updateItem(db, session.userId, itemId, patch);
  if (result.ok) revalidatePath("/");
  return result;
}

export async function patchItemAction(itemId: ItemId, patch: ItemPatch): Promise<ActionResult> {
  return updateItemFor(itemId, patch);
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
  return updateItemFor(itemId, {
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

  const result = moveItem(db, session.userId, itemId, deadline);
  if (result.ok) revalidatePath("/");
  return result;
}

export async function assignItemAction(
  itemId: ItemId,
  assigneeIds: number[]
): Promise<ActionResult> {
  const session = await requireSession();

  const result = assignItem(db, session.userId, itemId, assigneeIds);
  if (result.ok) revalidatePath("/");
  return result;
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

  const result = reorderItems(db, session.userId, bucketId, orderedIds);
  if (result.ok) revalidatePath("/");
  return result;
}

export async function deleteItemAction(itemId: ItemId): Promise<ActionResult> {
  const session = await requireSession();

  if (!deleteItem(db, session.userId, itemId)) return { ok: false, error: ITEM_GONE_ERROR };

  revalidatePath("/");
  return { ok: true };
}

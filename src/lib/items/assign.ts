import { eq } from "drizzle-orm";
import type { ItemId } from "@/types/ids";
import type { ActionResult } from "@/types/result";
import type { DbHandle } from "@/lib/db/handle";
import { items } from "@/lib/db/schema";
import { ITEM_GONE_ERROR, NOT_A_MEMBER_ERROR } from "@/constants";
import { findAccessibleItem } from "@/lib/buckets/access";
import { refreshItemReminders } from "@/lib/reminders/refresh";
import { allAreMembers, setItemAssignees } from "./assignees";

export function assignItem(
  h: DbHandle,
  userId: number,
  itemId: ItemId,
  assigneeIds: number[],
  now = new Date()
): ActionResult {
  return h.transaction((tx) => {
    const item = findAccessibleItem(tx, userId, itemId);
    if (!item) return { ok: false, error: ITEM_GONE_ERROR };
    if (!allAreMembers(tx, item.bucketId, assigneeIds)) {
      return { ok: false, error: NOT_A_MEMBER_ERROR };
    }

    setItemAssignees(tx, itemId, assigneeIds);
    tx.update(items).set({ updatedAt: now }).where(eq(items.id, itemId)).run();
    refreshItemReminders(tx, [itemId]);
    return { ok: true };
  });
}

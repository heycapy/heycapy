import type { ItemId } from "@/types/ids";
import type { ActionResult } from "@/types/result";
import type { DbHandle } from "@/lib/db/handle";
import { ITEM_GONE_ERROR } from "@/constants";
import { findAccessibleItem } from "@/lib/buckets/access";
import { userTimezone } from "@/lib/reminders/refresh";
import { resolveDeadline } from "./deadline";
import { moveOccurrence } from "./recurrence";

export function moveItem(
  h: DbHandle,
  userId: number,
  itemId: ItemId,
  deadline: string,
  now = new Date()
): ActionResult {
  const item = findAccessibleItem(h, userId, itemId);
  if (!item) return { ok: false, error: ITEM_GONE_ERROR };

  const due = resolveDeadline(deadline, userTimezone(h, userId), item);
  if (!due.deadline || isNaN(due.deadline.getTime())) return { ok: false, error: "Invalid date" };

  const result = moveOccurrence(
    h,
    userId,
    itemId,
    due.deadline,
    now,
    due.deadlineTimezone ?? undefined
  );
  return result.ok ? { ok: true } : result;
}

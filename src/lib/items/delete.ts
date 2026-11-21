import { eq } from "drizzle-orm";
import type { ItemId } from "@/types/ids";
import type { DbHandle } from "@/lib/db/handle";
import { items } from "@/lib/db/schema";
import { findAccessibleItem } from "@/lib/buckets/access";
import { refreshItemReminders } from "@/lib/reminders/refresh";

export function deleteItem(h: DbHandle, userId: number, itemId: ItemId, now = new Date()): boolean {
  return h.transaction((tx) => {
    if (!findAccessibleItem(tx, userId, itemId)) return false;
    tx.update(items)
      .set({ deletedAt: now, deletedBy: userId })
      .where(eq(items.id, itemId))
      .run();
    refreshItemReminders(tx, [itemId]);
    return true;
  });
}

import { and, eq, ne } from "drizzle-orm";
import type { ItemId } from "@/types/ids";
import type { ActionResult } from "@/types/result";
import type { DbHandle } from "@/lib/db/handle";
import { items } from "@/lib/db/schema";
import { findAccessibleBucket } from "@/lib/buckets/access";
import { bucketsChanged } from "@/lib/events";

// Ids from another bucket are skipped, and a row already in place isn't written
export function reorderItems(
  h: DbHandle,
  userId: number,
  bucketId: number,
  orderedIds: ItemId[]
): ActionResult {
  return h.transaction((tx) => {
    if (!findAccessibleBucket(tx, userId, bucketId)) {
      return { ok: false, error: "Bucket not found" };
    }
    orderedIds.forEach((id, i) => {
      tx.update(items)
        .set({ sortOrder: i })
        .where(and(eq(items.id, id), eq(items.bucketId, bucketId), ne(items.sortOrder, i)))
        .run();
    });
    bucketsChanged([bucketId]);
    return { ok: true };
  });
}

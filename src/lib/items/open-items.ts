import { and, eq, inArray, isNull, notInArray } from "drizzle-orm";
import { CLOSED_ITEM_STATUSES } from "@/constants";
import { db } from "@/lib/db";
import { buckets, items } from "@/lib/db/schema";
import { memberBucketIds } from "@/lib/buckets/access";
import { inLiveBucket } from "@/lib/buckets/live";

export type OpenItem = { bucketId: number; deadline: Date | null; deadlineTimezone: string | null };

// Just enough to count each bucket's open and late items; lateness is the viewer's own clock,
// so the browser works it out the same way a row's due label does
export function listOpenItems(userId: number): Promise<OpenItem[]> {
  return db
    .select({
      bucketId: items.bucketId,
      deadline: items.deadline,
      deadlineTimezone: items.deadlineTimezone,
    })
    .from(items)
    .innerJoin(buckets, eq(buckets.id, items.bucketId))
    .where(
      and(
        inArray(items.bucketId, memberBucketIds(userId)),
        isNull(items.deletedAt),
        inLiveBucket,
        notInArray(items.status, [...CLOSED_ITEM_STATUSES])
      )
    );
}

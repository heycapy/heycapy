import { and, count, desc, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { TRASH_RETENTION_DAYS } from "@/constants";
import { db } from "@/lib/db";
import { buckets, items, users } from "@/lib/db/schema";
import { findAccessibleItem, memberBucketIds, ownedBucketIds } from "@/lib/buckets/access";
import { memberName } from "@/lib/buckets/member-name";
import { initialReminderState } from "@/lib/items/reminders";
import { refreshItemReminders } from "@/lib/reminders/refresh";

export type TrashedBucket = { id: number; name: string; deletedAt: Date; itemCount: number };
export type TrashedItem = {
  id: number;
  title: string;
  deletedAt: Date;
  bucketId: number;
  bucketName: string;
  bucketInTrash: boolean;
  // Only in a bucket with other people: who deleted it, "you" for the viewer
  deletedBy: string | null;
  // Only the bucket's owner can delete forever
  canDelete: boolean;
};

export type DeleteForeverResult = "deleted" | "not_found" | "not_owner";

export async function listTrash(
  userId: number
): Promise<{ buckets: TrashedBucket[]; items: TrashedItem[] }> {
  const bucketRows = await db
    .select({ id: buckets.id, name: buckets.name, deletedAt: buckets.deletedAt })
    .from(buckets)
    .where(and(eq(buckets.userId, userId), isNotNull(buckets.deletedAt)))
    .orderBy(desc(buckets.deletedAt));
  const counts =
    bucketRows.length === 0
      ? []
      : await db
          .select({ bucketId: items.bucketId, n: count() })
          .from(items)
          .where(
            inArray(
              items.bucketId,
              bucketRows.map((b) => b.id)
            )
          )
          .groupBy(items.bucketId);
  const itemRows = await db
    .select({
      id: items.id,
      title: items.title,
      deletedAt: items.deletedAt,
      bucketId: items.bucketId,
      bucketName: buckets.name,
      bucketDeletedAt: buckets.deletedAt,
      bucketOwnerId: buckets.userId,
      deletedById: items.deletedBy,
      deleterName: users.displayName,
      deleterUsername: users.username,
      memberCount: sql<number>`(select count(*) from bucket_members where bucket_id = ${items.bucketId})`,
    })
    .from(items)
    .innerJoin(buckets, eq(buckets.id, items.bucketId))
    .leftJoin(users, eq(users.id, items.deletedBy))
    .where(
      and(
        inArray(items.bucketId, memberBucketIds(userId)),
        isNotNull(items.deletedAt),
        // A deleted bucket is gone for its members; only the owner can bring it back
        or(eq(buckets.userId, userId), isNull(buckets.deletedAt))
      )
    )
    .orderBy(desc(items.deletedAt));

  return {
    buckets: bucketRows.flatMap((b) =>
      b.deletedAt
        ? [
            {
              id: b.id,
              name: b.name,
              deletedAt: b.deletedAt,
              itemCount: counts.find((c) => c.bucketId === b.id)?.n ?? 0,
            },
          ]
        : []
    ),
    items: itemRows.flatMap((i) =>
      i.deletedAt
        ? [
            {
              id: i.id,
              title: i.title,
              deletedAt: i.deletedAt,
              bucketId: i.bucketId,
              bucketName: i.bucketName,
              bucketInTrash: i.bucketDeletedAt !== null,
              deletedBy:
                i.memberCount > 1 && i.deletedById !== null
                  ? i.deletedById === userId
                    ? "you"
                    : memberName({ displayName: i.deleterName, username: i.deleterUsername })
                  : null,
              canDelete: i.bucketOwnerId === userId,
            },
          ]
        : []
    ),
  };
}

// A due date that passed while it was in the trash comes back overdue, without a late "due now"
export async function restoreItem(userId: number, itemId: number, now = new Date()) {
  const item = await findAccessibleItem(userId, itemId);
  if (!item?.deletedAt) return false;
  await db
    .update(items)
    .set({
      deletedAt: null,
      deletedBy: null,
      ...(item.notifiedAt
        ? {}
        : initialReminderState(item.deadline, item.deadlineTimezone ?? "UTC", now)),
      updatedAt: now,
    })
    .where(eq(items.id, itemId));
  await refreshItemReminders([itemId]);
  return true;
}

export async function deleteItemForever(
  userId: number,
  itemId: number
): Promise<DeleteForeverResult> {
  const item = await findAccessibleItem(userId, itemId);
  if (!item?.deletedAt) return "not_found";
  const [removed] = await db
    .delete(items)
    .where(and(eq(items.id, itemId), inArray(items.bucketId, ownedBucketIds(userId))))
    .returning({ id: items.id });
  return removed ? "deleted" : "not_owner";
}

// Only what is in the user's own buckets: in a shared bucket the others' trash is the owner's to empty
export async function emptyTrash(userId: number): Promise<void> {
  await db
    .delete(items)
    .where(and(inArray(items.bucketId, ownedBucketIds(userId)), isNotNull(items.deletedAt)));
  await db.delete(buckets).where(and(eq(buckets.userId, userId), isNotNull(buckets.deletedAt)));
}

export async function purgeOldTrash(now = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  await db.delete(items).where(lt(items.deletedAt, cutoff));
  await db.delete(buckets).where(lt(buckets.deletedAt, cutoff));
}

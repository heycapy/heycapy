import { and, count, desc, eq, inArray, isNotNull, lt } from "drizzle-orm";
import { TRASH_RETENTION_DAYS } from "@/constants";
import { db } from "@/lib/db";
import { buckets, items } from "@/lib/db/schema";
import { initialReminderState } from "@/lib/items/reminders";
import { refreshItemReminders, reminderContext } from "@/lib/reminders/refresh";

export type TrashedBucket = { id: number; name: string; deletedAt: Date; itemCount: number };
export type TrashedItem = {
  id: number;
  title: string;
  deletedAt: Date;
  bucketId: number;
  bucketName: string;
  bucketInTrash: boolean;
};

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
    })
    .from(items)
    .innerJoin(buckets, eq(buckets.id, items.bucketId))
    .where(and(eq(items.userId, userId), isNotNull(items.deletedAt)))
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
            },
          ]
        : []
    ),
  };
}

// A due date that passed while it was in the trash comes back overdue, without a late "due now"
export async function restoreItem(userId: number, itemId: number, now = new Date()) {
  const item = await db.query.items.findFirst({
    where: and(eq(items.id, itemId), eq(items.userId, userId), isNotNull(items.deletedAt)),
  });
  if (!item) return false;
  const { timezone } = await reminderContext(item.bucketId);
  await db
    .update(items)
    .set({
      deletedAt: null,
      ...(item.notifiedAt ? {} : initialReminderState(item.deadline, timezone, now)),
      updatedAt: now,
    })
    .where(eq(items.id, itemId));
  await refreshItemReminders([itemId]);
  return true;
}

export async function deleteItemForever(userId: number, itemId: number): Promise<void> {
  await db
    .delete(items)
    .where(and(eq(items.id, itemId), eq(items.userId, userId), isNotNull(items.deletedAt)));
}

export async function emptyTrash(userId: number): Promise<void> {
  await db.delete(items).where(and(eq(items.userId, userId), isNotNull(items.deletedAt)));
  await db.delete(buckets).where(and(eq(buckets.userId, userId), isNotNull(buckets.deletedAt)));
}

export async function purgeOldTrash(now = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  await db.delete(items).where(lt(items.deletedAt, cutoff));
  await db.delete(buckets).where(lt(buckets.deletedAt, cutoff));
}

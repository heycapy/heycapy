import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bucketMembers, buckets } from "@/lib/db/schema";
import { startingChannels } from "@/lib/notifications/channels";

type NewBucket = Omit<typeof buckets.$inferInsert, "notificationsRules">;

// Case-insensitive, so "Todo" and "todo" count as the same name
export async function findBucketByName(
  userId: number,
  name: string,
  excludeId?: number
): Promise<{ id: number } | null> {
  const [row] = await db
    .select({ id: buckets.id })
    .from(buckets)
    .where(
      and(
        eq(buckets.userId, userId),
        isNull(buckets.deletedAt),
        sql`lower(${buckets.name}) = lower(${name})`,
        excludeId !== undefined ? ne(buckets.id, excludeId) : undefined
      )
    )
    .limit(1);
  return row ?? null;
}

export async function createBucket(values: NewBucket, notifications: unknown): Promise<number> {
  const { rules, channels } = await startingChannels(values.userId, notifications);
  return db.transaction((tx) => {
    const bucket = tx
      .insert(buckets)
      .values({ ...values, notificationsRules: JSON.stringify(rules) })
      .returning({ id: buckets.id })
      .get();
    tx.update(bucketMembers)
      .set({ channels: JSON.stringify(channels) })
      .where(and(eq(bucketMembers.bucketId, bucket.id), eq(bucketMembers.userId, values.userId)))
      .run();
    return bucket.id;
  });
}

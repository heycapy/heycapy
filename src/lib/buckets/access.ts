import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { bucketMembers, buckets, items } from "@/lib/db/schema";
import { inLiveBucket } from "@/lib/buckets/live";

type Bucket = typeof buckets.$inferSelect;
type Item = typeof items.$inferSelect;

export type ViewerBucket = Bucket & { isOwner: boolean };

// Every bucket the user can use, owned or joined
export function memberBucketIds(userId: number) {
  return db
    .select({ id: bucketMembers.bucketId })
    .from(bucketMembers)
    .where(eq(bucketMembers.userId, userId));
}

export function ownedBucketIds(userId: number) {
  return db.select({ id: buckets.id }).from(buckets).where(eq(buckets.userId, userId));
}

// The rows still hold what only the owner may see, so they stay on the server
export function findAccessibleBucket(
  userId: number,
  bucketId: number
): Promise<Bucket | undefined> {
  return db.query.buckets.findFirst({
    where: and(eq(buckets.id, bucketId), inArray(buckets.id, memberBucketIds(userId))),
  });
}

export function findAccessibleItem(userId: number, itemId: number): Promise<Item | undefined> {
  return db.query.items.findFirst({
    where: and(eq(items.id, itemId), inArray(items.bucketId, memberBucketIds(userId))),
  });
}

// Rows go to the browser as they are, so what only the owner may see is blanked for members
export function withoutOwnerSecrets(bucket: Bucket, viewerId: number): Bucket {
  if (bucket.userId === viewerId) return bucket;
  return {
    ...bucket,
    webhookKey: null,
    mcpIntegration: null,
    mcpConfig: null,
    telegramConfig: null,
  };
}

export async function listLiveBuckets(userId: number): Promise<ViewerBucket[]> {
  const rows = await db
    .select()
    .from(buckets)
    .where(and(inArray(buckets.id, memberBucketIds(userId)), inLiveBucket))
    .orderBy(asc(buckets.sortOrder), asc(buckets.createdAt));
  return rows.map((bucket) => ({
    ...withoutOwnerSecrets(bucket, userId),
    isOwner: bucket.userId === userId,
  }));
}

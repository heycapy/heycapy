import { and, asc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bucketMembers, buckets, items } from "@/lib/db/schema";
import { inLiveBucket } from "@/lib/buckets/live";

type Bucket = typeof buckets.$inferSelect;
type Item = typeof items.$inferSelect;

// myChannels: the viewer's own channels for the bucket, as stored
export type ViewerBucket = Bucket & { isOwner: boolean; myChannels: string; colorIndex: number };

export function byColorOrder(a: Bucket, b: Bucket): number {
  return a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id;
}

// Every bucket the user can use, owned or joined
export function memberBucketIds(userId: number) {
  return db
    .select({ id: bucketMembers.bucketId })
    .from(bucketMembers)
    .where(eq(bucketMembers.userId, userId));
}

export async function isBucketMember(userId: number, bucketId: number): Promise<boolean> {
  const row = await db.query.bucketMembers.findFirst({
    columns: { id: true },
    where: and(eq(bucketMembers.bucketId, bucketId), eq(bucketMembers.userId, userId)),
  });
  return row !== undefined;
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
    where: and(
      eq(items.id, itemId),
      inArray(items.bucketId, memberBucketIds(userId)),
      isNull(items.deletedAt)
    ),
  });
}

export function findTrashedItem(userId: number, itemId: number): Promise<Item | undefined> {
  return db.query.items.findFirst({
    where: and(
      eq(items.id, itemId),
      inArray(items.bucketId, memberBucketIds(userId)),
      isNotNull(items.deletedAt)
    ),
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
    .select({ bucket: buckets, myChannels: bucketMembers.channels })
    .from(buckets)
    .innerJoin(
      bucketMembers,
      and(eq(bucketMembers.bucketId, buckets.id), eq(bucketMembers.userId, userId))
    )
    .where(inLiveBucket)
    .orderBy(
      sql`${bucketMembers.sortOrder} is null`,
      asc(bucketMembers.sortOrder),
      asc(buckets.sortOrder),
      asc(buckets.createdAt)
    );
  const colorOrder = rows.map((r) => r.bucket).sort(byColorOrder);
  return rows.map(({ bucket, myChannels }) => ({
    ...withoutOwnerSecrets(bucket, userId),
    isOwner: bucket.userId === userId,
    myChannels,
    colorIndex: colorOrder.indexOf(bucket),
  }));
}

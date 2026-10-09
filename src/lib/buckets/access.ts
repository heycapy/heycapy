import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { bucketMembers, buckets } from "@/lib/db/schema";
import { inLiveBucket } from "@/lib/buckets/live";

type Bucket = typeof buckets.$inferSelect;

// Every bucket the user can use, owned or joined
export function memberBucketIds(userId: number) {
  return db
    .select({ id: bucketMembers.bucketId })
    .from(bucketMembers)
    .where(eq(bucketMembers.userId, userId));
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

export async function listLiveBuckets(userId: number): Promise<Bucket[]> {
  const rows = await db
    .select()
    .from(buckets)
    .where(and(inArray(buckets.id, memberBucketIds(userId)), inLiveBucket))
    .orderBy(asc(buckets.sortOrder), asc(buckets.createdAt));
  return rows.map((bucket) => withoutOwnerSecrets(bucket, userId));
}

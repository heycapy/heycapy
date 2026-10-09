import { redirect } from "next/navigation";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { buckets, items } from "@/lib/db/schema";
import { listLiveBuckets, memberBucketIds } from "@/lib/buckets/access";
import { BucketsEmptyState } from "@/components/buckets/BucketsEmptyState";
import { BucketsShell } from "@/components/buckets/BucketsShell";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const userBuckets = await listLiveBuckets(session.userId);

  if (userBuckets.length === 0) {
    const [archived, deletedBucket, deletedItem] = await Promise.all([
      db
        .select({ id: buckets.id })
        .from(buckets)
        .where(
          and(
            eq(buckets.userId, session.userId),
            isNotNull(buckets.archivedAt),
            isNull(buckets.deletedAt)
          )
        )
        .limit(1),
      db
        .select({ id: buckets.id })
        .from(buckets)
        .where(and(eq(buckets.userId, session.userId), isNotNull(buckets.deletedAt)))
        .limit(1),
      db
        .select({ id: items.id })
        .from(items)
        .where(
          and(inArray(items.bucketId, memberBucketIds(session.userId)), isNotNull(items.deletedAt))
        )
        .limit(1),
    ]);
    return (
      <BucketsEmptyState
        hasArchived={archived.length > 0}
        hasTrash={deletedBucket.length > 0 || deletedItem.length > 0}
      />
    );
  }

  const { bucket } = await searchParams;
  const focusBucketId = typeof bucket === "string" ? Number(bucket) : null;
  return <BucketsShell buckets={userBuckets} focusBucketId={focusBucketId} />;
}

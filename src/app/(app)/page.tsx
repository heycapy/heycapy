import { redirect } from "next/navigation";
import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { buckets, items } from "@/lib/db/schema";
import { BucketsEmptyState } from "@/components/buckets/BucketsEmptyState";
import { BucketsShell } from "@/components/buckets/BucketsShell";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const userBuckets = await db
    .select()
    .from(buckets)
    .where(
      and(eq(buckets.userId, session.userId), isNull(buckets.deletedAt), isNull(buckets.archivedAt))
    )
    .orderBy(asc(buckets.sortOrder), asc(buckets.createdAt));

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
        .where(and(eq(items.userId, session.userId), isNotNull(items.deletedAt)))
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

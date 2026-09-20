import { redirect } from "next/navigation";
import { and, asc, eq, isNull, ne } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { buckets, items as itemsTable } from "@/lib/db/schema";
import { BucketsEmptyState } from "@/components/buckets/BucketsEmptyState";
import { BucketCard } from "@/components/buckets/BucketCard";
import { NewBucketButton } from "@/components/buckets/NewBucketButton";

export default async function Home() {
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
    return <BucketsEmptyState />;
  }

  const allItems = await db
    .select()
    .from(itemsTable)
    .where(
      and(
        eq(itemsTable.userId, session.userId),
        isNull(itemsTable.deletedAt),
        ne(itemsTable.status, "archived")
      )
    )
    .orderBy(asc(itemsTable.sortOrder), asc(itemsTable.createdAt));

  const itemsByBucket: Record<number, typeof allItems> = {};
  for (const item of allItems) {
    if (!itemsByBucket[item.bucketId]) itemsByBucket[item.bucketId] = [];
    itemsByBucket[item.bucketId].push(item);
  }

  return (
    <div className="mx-auto w-full max-w-md p-4">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-muted-foreground font-mono text-xs">
          {userBuckets.length} {userBuckets.length === 1 ? "bucket" : "buckets"}
        </span>
        <NewBucketButton />
      </div>
      <div className="flex flex-col gap-2.5">
        {userBuckets.map((b) => (
          <BucketCard key={b.id} bucket={b} items={itemsByBucket[b.id] ?? []} />
        ))}
      </div>
    </div>
  );
}

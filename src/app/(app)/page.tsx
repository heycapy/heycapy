import { redirect } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { buckets } from "@/lib/db/schema";
import { BucketsEmptyState } from "@/components/buckets/BucketsEmptyState";

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

  // TODO: PRE-70 — replace with BucketCard
  return (
    <div className="flex flex-col gap-2 p-4">
      {userBuckets.map((b) => (
        <div key={b.id} className="border-border bg-card rounded border px-4 py-3 text-sm">
          {b.icon ? `${b.icon} ` : ""}
          {b.name}
        </div>
      ))}
    </div>
  );
}

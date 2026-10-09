import { and, asc, eq, exists, inArray, isNull, ne, sql } from "drizzle-orm";
import { db, type DB } from "@/lib/db";
import { authRateLimits, bucketMembers, buckets, items, otps, users } from "@/lib/db/schema";

export type SharedBucket = { id: number; name: string };

// A bucket in the trash is already gone for its members, so only live and archived ones count
export function ownedSharedBuckets(executor: Pick<DB, "select">, userId: number): SharedBucket[] {
  return executor
    .select({ id: buckets.id, name: buckets.name })
    .from(buckets)
    .where(
      and(
        eq(buckets.userId, userId),
        isNull(buckets.deletedAt),
        exists(
          executor
            .select({ one: sql`1` })
            .from(bucketMembers)
            .where(and(eq(bucketMembers.bucketId, buckets.id), ne(bucketMembers.userId, userId)))
        )
      )
    )
    .orderBy(asc(buckets.name))
    .all();
}

// Returns the shared buckets in the way, and deletes nothing, while the user still owns any.
// Everything else (settings, buckets, items, history, chats, templates) goes with the user deletion
export function deleteAccount(userId: number, email: string): SharedBucket[] {
  return db.transaction((tx) => {
    const blocking = ownedSharedBuckets(tx, userId);
    if (blocking.length > 0) return blocking;

    // What they added to other people's buckets stays, with the bucket's owner
    tx.update(items)
      .set({
        userId: sql`(select ${buckets.userId} from ${buckets} where ${buckets.id} = ${items.bucketId})`,
      })
      .where(
        and(
          eq(items.userId, userId),
          inArray(
            items.bucketId,
            tx.select({ id: buckets.id }).from(buckets).where(ne(buckets.userId, userId))
          )
        )
      )
      .run();
    tx.delete(users).where(eq(users.id, userId)).run();
    tx.delete(otps).where(eq(otps.email, email)).run();
    tx.delete(authRateLimits).where(eq(authRateLimits.email, email)).run();
    return [];
  });
}

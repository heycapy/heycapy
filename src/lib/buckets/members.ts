import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bucketMembers, buckets, items, notificationQueue, users } from "@/lib/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type BucketMember = {
  userId: number;
  username: string | null;
  displayName: string | null;
  role: "owner" | "member";
  joinedAt: Date;
};

export type MemberChangeResult =
  { ok: true } | { ok: false; reason: "not_found" | "not_owner" | "is_owner" };

// Never the email: members only know each other by name
export async function listMembers(
  viewerId: number,
  bucketId: number
): Promise<BucketMember[] | null> {
  const viewer = await db.query.bucketMembers.findFirst({
    columns: { id: true },
    where: and(eq(bucketMembers.bucketId, bucketId), eq(bucketMembers.userId, viewerId)),
  });
  if (!viewer) return null;

  return db
    .select({
      userId: users.id,
      username: users.username,
      displayName: users.displayName,
      role: bucketMembers.role,
      joinedAt: bucketMembers.createdAt,
    })
    .from(bucketMembers)
    .innerJoin(users, eq(users.id, bucketMembers.userId))
    .where(eq(bucketMembers.bucketId, bucketId))
    .orderBy(
      sql`${bucketMembers.role} = 'owner' desc`,
      asc(bucketMembers.createdAt),
      asc(bucketMembers.id)
    );
}

// Reminders already queued for them would still arrive for a bucket they can no longer see
function dropMember(tx: Tx, bucketId: number, userId: number): void {
  tx.delete(bucketMembers)
    .where(and(eq(bucketMembers.bucketId, bucketId), eq(bucketMembers.userId, userId)))
    .run();
  tx.update(items)
    .set({ assigneeId: null })
    .where(and(eq(items.bucketId, bucketId), eq(items.assigneeId, userId)))
    .run();
  tx.update(notificationQueue)
    .set({ status: "cancelled", lastError: "no longer a member of the bucket" })
    .where(
      and(
        eq(notificationQueue.userId, userId),
        inArray(notificationQueue.status, ["pending", "sending"]),
        inArray(
          notificationQueue.itemId,
          tx.select({ id: items.id }).from(items).where(eq(items.bucketId, bucketId))
        )
      )
    )
    .run();
}

export function removeMember(
  ownerId: number,
  bucketId: number,
  memberId: number
): MemberChangeResult {
  return db.transaction((tx) => {
    const bucket = tx
      .select({ userId: buckets.userId })
      .from(buckets)
      .where(eq(buckets.id, bucketId))
      .get();
    if (!bucket || bucket.userId !== ownerId) return { ok: false, reason: "not_owner" };
    if (memberId === ownerId) return { ok: false, reason: "is_owner" };
    const member = tx
      .select({ id: bucketMembers.id })
      .from(bucketMembers)
      .where(and(eq(bucketMembers.bucketId, bucketId), eq(bucketMembers.userId, memberId)))
      .get();
    if (!member) return { ok: false, reason: "not_found" };

    dropMember(tx, bucketId, memberId);
    return { ok: true };
  });
}

export function leaveBucket(userId: number, bucketId: number): MemberChangeResult {
  return db.transaction((tx) => {
    const member = tx
      .select({ role: bucketMembers.role })
      .from(bucketMembers)
      .where(and(eq(bucketMembers.bucketId, bucketId), eq(bucketMembers.userId, userId)))
      .get();
    if (!member) return { ok: false, reason: "not_found" };
    if (member.role === "owner") return { ok: false, reason: "is_owner" };

    dropMember(tx, bucketId, userId);
    return { ok: true };
  });
}

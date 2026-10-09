import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bucketMembers, buckets, users } from "@/lib/db/schema";
import { seedBucket, seedUser } from "./helpers";

async function membersOf(bucketId: number) {
  return db
    .select({ userId: bucketMembers.userId, role: bucketMembers.role })
    .from(bucketMembers)
    .where(eq(bucketMembers.bucketId, bucketId));
}

describe("bucket members", () => {
  it("adds the owner as a member whenever a bucket is created", async () => {
    const owner = await seedUser();
    const bucketId = await seedBucket(owner);

    expect(await membersOf(bucketId)).toEqual([{ userId: owner, role: "owner" }]);
  });

  it("lets a second user join, once", async () => {
    const owner = await seedUser();
    const friend = await seedUser();
    const bucketId = await seedBucket(owner);

    await db.insert(bucketMembers).values({ bucketId, userId: friend });

    expect(await membersOf(bucketId)).toEqual([
      { userId: owner, role: "owner" },
      { userId: friend, role: "member" },
    ]);
    await expect(db.insert(bucketMembers).values({ bucketId, userId: friend })).rejects.toThrow();
  });

  it("drops the memberships of a deleted bucket", async () => {
    const owner = await seedUser();
    const bucketId = await seedBucket(owner);

    await db.delete(buckets).where(eq(buckets.id, bucketId));

    expect(await membersOf(bucketId)).toEqual([]);
  });

  it("drops a deleted user's memberships and leaves the other members in the bucket", async () => {
    const owner = await seedUser();
    const friend = await seedUser();
    const bucketId = await seedBucket(owner);
    await db.insert(bucketMembers).values({ bucketId, userId: friend });

    await db.delete(users).where(eq(users.id, friend));

    expect(await membersOf(bucketId)).toEqual([{ userId: owner, role: "owner" }]);
  });
});

import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bucketMembers } from "@/lib/db/schema";
import { findAccessibleBucket, findAccessibleItem } from "@/lib/buckets/access";
import { seedBucket, seedItem, seedUser } from "./helpers";

async function sharedBucket() {
  const owner = await seedUser();
  const member = await seedUser();
  const stranger = await seedUser();
  const bucketId = await seedBucket(owner);
  await db.insert(bucketMembers).values({ bucketId, userId: member });
  const itemId = await seedItem(owner, bucketId, { deadline: new Date() });
  return { owner, member, stranger, bucketId, itemId };
}

describe("findAccessibleBucket", () => {
  it("finds the bucket for its owner and for a member, not for anyone else", async () => {
    const { owner, member, stranger, bucketId } = await sharedBucket();

    expect((await findAccessibleBucket(owner, bucketId))?.id).toBe(bucketId);
    expect((await findAccessibleBucket(member, bucketId))?.id).toBe(bucketId);
    expect(await findAccessibleBucket(stranger, bucketId)).toBeUndefined();
  });

  it("does not find a bucket that doesn't exist", async () => {
    expect(await findAccessibleBucket(await seedUser(), 999_999)).toBeUndefined();
  });
});

describe("findAccessibleItem", () => {
  it("finds the item for the owner and for a member, even one they didn't add", async () => {
    const { owner, member, itemId } = await sharedBucket();

    expect((await findAccessibleItem(owner, itemId))?.id).toBe(itemId);
    expect((await findAccessibleItem(member, itemId))?.id).toBe(itemId);
  });

  it("does not find it for someone outside the bucket", async () => {
    const { stranger, itemId } = await sharedBucket();
    expect(await findAccessibleItem(stranger, itemId)).toBeUndefined();
  });

  it("stops finding it the moment a member is removed", async () => {
    const { member, itemId } = await sharedBucket();
    expect(await findAccessibleItem(member, itemId)).toBeDefined();

    await db.delete(bucketMembers).where(eq(bucketMembers.userId, member));

    expect(await findAccessibleItem(member, itemId)).toBeUndefined();
  });
});

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bucketMembers, notificationQueue, users } from "@/lib/db/schema";
import { leaveBucket, listMembers, removeMember } from "@/lib/buckets/members";
import { enqueue, processPending } from "@/lib/notifications/queue";
import {
  HOUR,
  resetSchedulerEnvironment,
  seedBucket,
  seedItem,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

const T0 = new Date("2026-03-10T12:00:00Z");

beforeEach(() => useSchedulerEnvironment(T0));
afterEach(() => resetSchedulerEnvironment());

async function sharedBucket() {
  const owner = await seedUser();
  const friend = await seedUser();
  const bucketId = await seedBucket(owner);
  await db.insert(bucketMembers).values({ bucketId, userId: friend });
  const itemId = await seedItem(owner, bucketId, { deadline: new Date(T0.getTime() + HOUR) });
  return { owner, friend, bucketId, itemId };
}

async function statuses(userId: number) {
  const rows = await db
    .select()
    .from(notificationQueue)
    .where(eq(notificationQueue.userId, userId));
  return rows.map((row) => row.status);
}

describe("the member list", () => {
  it("shows the owner first, by name and never by email, to anyone in the bucket", async () => {
    const { owner, friend, bucketId } = await sharedBucket();
    await db
      .update(users)
      .set({ displayName: "Sam", username: "sleepy_otter_juggling" })
      .where(eq(users.id, friend));

    const asFriend = await listMembers(friend, bucketId);
    const asOwner = await listMembers(owner, bucketId);

    expect(asFriend?.map((m) => [m.userId, m.role])).toEqual([
      [owner, "owner"],
      [friend, "member"],
    ]);
    expect(asFriend?.[1]).toMatchObject({ displayName: "Sam", username: "sleepy_otter_juggling" });
    expect(JSON.stringify(asFriend)).not.toContain("@heycapy.test");
    expect(asOwner).toEqual(asFriend);
  });

  it("is not shown to someone outside the bucket", async () => {
    const { bucketId } = await sharedBucket();
    expect(await listMembers(await seedUser(), bucketId)).toBeNull();
  });
});

describe("removing a member", () => {
  it("is for the owner, and cancels the reminders already queued for that member in the bucket", async () => {
    const { owner, friend, bucketId, itemId } = await sharedBucket();
    const otherBucket = await seedBucket(owner);
    const otherItem = await seedItem(owner, otherBucket, {
      deadline: new Date(T0.getTime() + HOUR),
    });
    await db.insert(bucketMembers).values({ bucketId: otherBucket, userId: friend });
    await enqueue({ userId: friend, itemId, medium: "telegram", title: "t", message: "a" });
    await enqueue({
      userId: friend,
      itemId: otherItem,
      medium: "telegram",
      title: "t",
      message: "b",
    });
    await enqueue({ userId: owner, itemId, medium: "telegram", title: "t", message: "c" });

    expect(removeMember(owner, bucketId, friend)).toEqual({ ok: true });

    expect((await listMembers(owner, bucketId))?.map((m) => m.userId)).toEqual([owner]);
    const mine = await db
      .select()
      .from(notificationQueue)
      .where(eq(notificationQueue.userId, friend));
    expect(mine.map((j) => [j.message, j.status]).sort()).toEqual([
      ["a", "cancelled"],
      ["b", "pending"],
    ]);
    expect(await statuses(owner)).toEqual(["pending"]);
  });

  it("is refused for a member, a stranger, the owner themselves and someone who isn't in it", async () => {
    const { owner, friend, bucketId } = await sharedBucket();
    const stranger = await seedUser();

    expect(removeMember(friend, bucketId, owner)).toEqual({ ok: false, reason: "not_owner" });
    expect(removeMember(stranger, bucketId, friend)).toEqual({ ok: false, reason: "not_owner" });
    expect(removeMember(owner, bucketId, owner)).toEqual({ ok: false, reason: "is_owner" });
    expect(removeMember(owner, bucketId, stranger)).toEqual({ ok: false, reason: "not_found" });
    expect((await listMembers(owner, bucketId))?.length).toBe(2);
  });
});

describe("leaving a bucket", () => {
  it("takes a member out and cancels their queued reminders", async () => {
    const { owner, friend, bucketId, itemId } = await sharedBucket();
    await enqueue({ userId: friend, itemId, medium: "telegram", title: "t", message: "a" });

    expect(leaveBucket(friend, bucketId)).toEqual({ ok: true });

    expect((await listMembers(owner, bucketId))?.map((m) => m.userId)).toEqual([owner]);
    expect(await listMembers(friend, bucketId)).toBeNull();
    expect(await statuses(friend)).toEqual(["cancelled"]);
  });

  it("is not allowed for the owner, and not possible for someone outside", async () => {
    const { owner, bucketId } = await sharedBucket();

    expect(leaveBucket(owner, bucketId)).toEqual({ ok: false, reason: "is_owner" });
    expect(leaveBucket(await seedUser(), bucketId)).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("a queued reminder for someone who is no longer in the bucket", () => {
  it("is cancelled and never sent", async () => {
    const { friend, bucketId, itemId } = await sharedBucket();
    await enqueue({ userId: friend, itemId, medium: "telegram", title: "t", message: "a" });
    await db.delete(bucketMembers).where(eq(bucketMembers.bucketId, bucketId));

    await processPending();

    const [job] = await db
      .select()
      .from(notificationQueue)
      .where(eq(notificationQueue.userId, friend));
    expect(job).toMatchObject({
      status: "cancelled",
      lastError: "no longer a member of the bucket",
    });
  });
});

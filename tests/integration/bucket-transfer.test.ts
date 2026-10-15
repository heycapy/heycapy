import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bucketMembers, buckets } from "@/lib/db/schema";
import { leaveBucket, transferOwnership } from "@/lib/buckets/members";
import { ownedSharedBuckets } from "@/lib/account/delete";
import { getMemberChannels } from "@/lib/notifications/channels";
import {
  resetSchedulerEnvironment,
  seedBucket,
  seedMember,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

beforeEach(() => useSchedulerEnvironment(new Date("2026-03-10T12:00:00Z")));
afterEach(() => resetSchedulerEnvironment());

async function sharedBucket(name = `Home ${Math.random()}`) {
  const owner = await seedUser();
  const friend = await seedUser();
  const bucketId = await seedBucket(owner, { medium: ["telegram"], webhooks: [] });
  await db.update(buckets).set({ name, webhookKey: "old-key" }).where(eq(buckets.id, bucketId));
  await seedMember(bucketId, friend, ["email"]);
  return { owner, friend, bucketId };
}

const bucketOf = async (bucketId: number) =>
  db.query.buckets.findFirst({ where: eq(buckets.id, bucketId) });

async function roles(bucketId: number) {
  const rows = await db
    .select({ userId: bucketMembers.userId, role: bucketMembers.role })
    .from(bucketMembers)
    .where(eq(bucketMembers.bucketId, bucketId));
  return Object.fromEntries(rows.map((r) => [r.userId, r.role]));
}

describe("handing a bucket to another member", () => {
  it("makes them the owner and keeps the old owner as a member", async () => {
    const { owner, friend, bucketId } = await sharedBucket();

    expect(transferOwnership(owner, bucketId, friend)).toEqual({ ok: true });

    const bucket = await bucketOf(bucketId);
    expect(bucket?.userId).toBe(friend);
    expect(bucket?.webhookKey).not.toBe("old-key");
    expect(bucket?.webhookKey).not.toBeNull();
    expect(await roles(bucketId)).toEqual({ [owner]: "member", [friend]: "owner" });
    expect((await getMemberChannels(owner, bucketId)).medium).toEqual(["telegram"]);
    expect((await getMemberChannels(friend, bucketId)).medium).toEqual(["email"]);
  });

  it("lets the old owner leave and delete their account afterwards", async () => {
    const { owner, friend, bucketId } = await sharedBucket();
    expect(ownedSharedBuckets(db, owner).map((b) => b.id)).toEqual([bucketId]);

    transferOwnership(owner, bucketId, friend);

    expect(ownedSharedBuckets(db, owner)).toEqual([]);
    expect(ownedSharedBuckets(db, friend).map((b) => b.id)).toEqual([bucketId]);
    expect(leaveBucket(friend, bucketId)).toEqual({ ok: false, reason: "is_owner" });
    expect(leaveBucket(owner, bucketId)).toEqual({ ok: true });
  });

  it("keeps a bucket without an incoming webhook without one", async () => {
    const { owner, friend, bucketId } = await sharedBucket();
    await db.update(buckets).set({ webhookKey: null }).where(eq(buckets.id, bucketId));

    transferOwnership(owner, bucketId, friend);

    expect((await bucketOf(bucketId))?.webhookKey).toBeNull();
  });

  it("is refused to anyone but the owner, and to anyone outside the bucket", async () => {
    const { owner, friend, bucketId } = await sharedBucket();
    const stranger = await seedUser();
    const before = await bucketOf(bucketId);

    expect(transferOwnership(friend, bucketId, friend)).toEqual({
      ok: false,
      reason: "not_owner",
    });
    expect(transferOwnership(stranger, bucketId, stranger)).toEqual({
      ok: false,
      reason: "not_owner",
    });
    expect(transferOwnership(owner, bucketId, stranger)).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(transferOwnership(owner, bucketId, owner)).toEqual({ ok: false, reason: "is_owner" });

    expect(await bucketOf(bucketId)).toEqual(before);
    expect(await roles(bucketId)).toEqual({ [owner]: "owner", [friend]: "member" });
  });

  it("is refused for a bucket in the trash", async () => {
    const { owner, friend, bucketId } = await sharedBucket();
    await db.update(buckets).set({ deletedAt: new Date() }).where(eq(buckets.id, bucketId));

    expect(transferOwnership(owner, bucketId, friend)).toEqual({
      ok: false,
      reason: "not_owner",
    });
    expect((await bucketOf(bucketId))?.userId).toBe(owner);
  });

  it("is refused when the new owner already has a bucket with that name", async () => {
    const { owner, friend, bucketId } = await sharedBucket("Groceries");
    const theirs = await seedBucket(friend);
    await db.update(buckets).set({ name: "groceries" }).where(eq(buckets.id, theirs));

    expect(transferOwnership(owner, bucketId, friend)).toEqual({
      ok: false,
      reason: "name_taken",
    });
    expect((await bucketOf(bucketId))?.userId).toBe(owner);

    await db.update(buckets).set({ deletedAt: new Date() }).where(eq(buckets.id, theirs));
    expect(transferOwnership(owner, bucketId, friend)).toEqual({ ok: true });
  });

  it("drops the Telegram shortcut only when the new owner already uses it", async () => {
    const { owner, friend, bucketId } = await sharedBucket();
    const config = { alias: "food", timeSlots: ["09:00"] };
    await db
      .update(buckets)
      .set({ telegramConfig: JSON.stringify(config) })
      .where(eq(buckets.id, bucketId));
    const theirs = await seedBucket(friend);
    await db
      .update(buckets)
      .set({ telegramConfig: JSON.stringify({ alias: "food" }) })
      .where(eq(buckets.id, theirs));

    transferOwnership(owner, bucketId, friend);
    expect(JSON.parse((await bucketOf(bucketId))?.telegramConfig ?? "{}")).toEqual({
      alias: null,
      timeSlots: ["09:00"],
    });

    const other = await sharedBucket();
    await db
      .update(buckets)
      .set({ telegramConfig: JSON.stringify(config) })
      .where(eq(buckets.id, other.bucketId));
    transferOwnership(other.owner, other.bucketId, other.friend);
    expect(JSON.parse((await bucketOf(other.bucketId))?.telegramConfig ?? "{}")).toEqual(config);
  });
});

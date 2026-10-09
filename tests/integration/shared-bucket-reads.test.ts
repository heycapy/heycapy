import { beforeAll, describe, expect, it, vi } from "vitest";
import type * as SessionModule from "@/lib/auth/session";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bucketMembers, buckets } from "@/lib/db/schema";
import { listLiveBuckets } from "@/lib/buckets/access";
import { listToday, searchItems } from "@/lib/items/today";
import { getItemsForBucketAction } from "@/app/(app)/item-actions";
import { HOUR, seedBucket, seedItem, seedUser } from "./helpers";

const session = vi.hoisted(() => ({ userId: 0, email: "" }));
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof SessionModule>()),
  getSession: async () => session,
}));

const NOW = new Date("2026-03-10T12:00:00Z");

let owner = 0;
let friend = 0;
let stranger = 0;
let bucketId = 0;

beforeAll(async () => {
  owner = await seedUser();
  friend = await seedUser();
  stranger = await seedUser();
  bucketId = await seedBucket(owner);
  await db
    .update(buckets)
    .set({ webhookKey: "secret-key", telegramConfig: "{}", mcpConfig: "{}", mcpIntegration: "x" })
    .where(eq(buckets.id, bucketId));
  await db.insert(bucketMembers).values({ bucketId, userId: friend });
  await seedItem(owner, bucketId, { title: "pay rent", deadline: new Date(NOW.getTime() + HOUR) });
  await seedItem(friend, bucketId, {
    title: "rent receipt",
    deadline: new Date(NOW.getTime() + 2 * HOUR),
  });
});

const titles = (rows: { title: string }[]) => rows.map((r) => r.title);

describe("a member of a shared bucket", () => {
  it("sees every item due soon, whoever added it", async () => {
    expect(titles((await listToday(friend, NOW)).items)).toEqual(["pay rent", "rent receipt"]);
    expect(titles((await listToday(owner, NOW)).items)).toEqual(["pay rent", "rent receipt"]);
  });

  it("finds every item by search", async () => {
    expect(titles((await searchItems(friend, "rent")).items).sort()).toEqual([
      "pay rent",
      "rent receipt",
    ]);
  });

  it("gets the bucket in the list but not the owner's secrets", async () => {
    const [seen] = await listLiveBuckets(friend);
    expect(seen).toMatchObject({
      id: bucketId,
      isOwner: false,
      webhookKey: null,
      telegramConfig: null,
      mcpConfig: null,
      mcpIntegration: null,
    });
    const [own] = await listLiveBuckets(owner);
    expect(own).toMatchObject({
      id: bucketId,
      isOwner: true,
      webhookKey: "secret-key",
      telegramConfig: "{}",
    });
  });

  it("gets the items of the bucket from the items action", async () => {
    session.userId = friend;
    const result = await getItemsForBucketAction(bucketId);
    expect(result.ok && titles(result.items).sort()).toEqual(["pay rent", "rent receipt"]);
  });
});

describe("someone who is not a member", () => {
  it("sees nothing of the bucket", async () => {
    expect((await listToday(stranger, NOW)).items).toEqual([]);
    expect((await searchItems(stranger, "rent")).items).toEqual([]);
    expect(await listLiveBuckets(stranger)).toEqual([]);
    session.userId = stranger;
    expect(await getItemsForBucketAction(bucketId)).toMatchObject({ ok: false });
  });

  it("is what a member becomes once removed", async () => {
    await db
      .delete(bucketMembers)
      .where(and(eq(bucketMembers.bucketId, bucketId), eq(bucketMembers.userId, friend)));

    expect((await listToday(friend, NOW)).items).toEqual([]);
    expect(await listLiveBuckets(friend)).toEqual([]);
    session.userId = friend;
    expect(await getItemsForBucketAction(bucketId)).toMatchObject({ ok: false });
  });
});

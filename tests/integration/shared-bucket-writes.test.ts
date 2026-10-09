import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as SessionModule from "@/lib/auth/session";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bucketMembers, items } from "@/lib/db/schema";
import { ITEM_STATUS } from "@/constants";
import {
  addItemAction,
  completeItemAction,
  deleteItemAction,
  moveItemAction,
  reorderItemsAction,
  skipOccurrenceAction,
  updateItemAction,
} from "@/app/(app)/item-actions";
import {
  HOUR,
  resetSchedulerEnvironment,
  seedBucket,
  seedItem,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

const session = vi.hoisted(() => ({ userId: 0, email: "" }));
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof SessionModule>()),
  getSession: async () => session,
}));

const NOW = new Date("2026-03-10T12:00:00Z");
const WEEKLY = JSON.stringify({ enabled: true, frequency: "weekly", interval: 1, endDate: null });

beforeEach(() => useSchedulerEnvironment(NOW));
afterEach(() => resetSchedulerEnvironment());

async function sharedBucket() {
  const owner = await seedUser();
  const friend = await seedUser();
  const stranger = await seedUser();
  const bucketId = await seedBucket(owner);
  await db.insert(bucketMembers).values({ bucketId, userId: friend });
  const itemId = await seedItem(owner, bucketId, {
    title: "pay rent",
    deadline: new Date(NOW.getTime() + HOUR),
  });
  return { owner, friend, stranger, bucketId, itemId };
}

async function itemOf(itemId: number) {
  const [row] = await db.select().from(items).where(eq(items.id, itemId));
  return row;
}

describe("a member adding items", () => {
  it("adds to the shared bucket and is recorded as the one who added it", async () => {
    const { friend, bucketId } = await sharedBucket();
    session.userId = friend;

    expect(await addItemAction(bucketId, "buy milk", null)).toEqual({ ok: true });

    const added = await db.select().from(items).where(eq(items.title, "buy milk"));
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ bucketId, userId: friend });
  });

  it("is refused for someone outside the bucket", async () => {
    const { stranger, bucketId } = await sharedBucket();
    session.userId = stranger;

    expect(await addItemAction(bucketId, "sneaky", null)).toEqual({
      ok: false,
      error: "Bucket not found",
    });
    expect(await db.select().from(items).where(eq(items.title, "sneaky"))).toEqual([]);
  });

  it("stops working the moment the member is removed", async () => {
    const { friend, bucketId } = await sharedBucket();
    session.userId = friend;
    expect(await addItemAction(bucketId, "first", null)).toEqual({ ok: true });

    await db.delete(bucketMembers).where(eq(bucketMembers.userId, friend));

    expect(await addItemAction(bucketId, "second", null)).toMatchObject({ ok: false });
  });
});

describe("a member changing someone else's item", () => {
  it("can edit, complete, move and delete it", async () => {
    const { friend, itemId } = await sharedBucket();
    session.userId = friend;

    expect(await updateItemAction(itemId, "pay rent today", null)).toEqual({ ok: true });
    expect((await itemOf(itemId)).title).toBe("pay rent today");

    expect(await moveItemAction(itemId, "2026-03-12")).toEqual({ ok: true });
    expect((await itemOf(itemId)).deadline?.toISOString().slice(0, 10)).toBe("2026-03-12");

    expect(await completeItemAction(itemId)).toEqual({ ok: true });
    expect((await itemOf(itemId)).status).toBe(ITEM_STATUS.completed);

    expect(await deleteItemAction(itemId)).toEqual({ ok: true });
    expect((await itemOf(itemId)).deletedAt).not.toBeNull();
  });

  it("can skip a repeating occurrence", async () => {
    const { friend, itemId } = await sharedBucket();
    await db.update(items).set({ recurring: WEEKLY }).where(eq(items.id, itemId));
    const before = (await itemOf(itemId)).deadline;
    session.userId = friend;

    expect(await skipOccurrenceAction(itemId)).toEqual({ ok: true });

    expect((await itemOf(itemId)).deadline?.getTime()).toBeGreaterThan(before?.getTime() ?? 0);
  });

  it("is refused for someone outside the bucket, and nothing changes", async () => {
    const { stranger, itemId } = await sharedBucket();
    await db.update(items).set({ recurring: WEEKLY }).where(eq(items.id, itemId));
    const before = await itemOf(itemId);
    session.userId = stranger;

    const results = [
      await updateItemAction(itemId, "mine now", null),
      await moveItemAction(itemId, "2026-03-12"),
      await completeItemAction(itemId),
      await deleteItemAction(itemId),
      await skipOccurrenceAction(itemId),
    ];

    for (const result of results) expect(result).toEqual({ ok: false, error: "Item not found" });
    expect(await itemOf(itemId)).toEqual(before);
  });
});

describe("reordering a shared bucket", () => {
  it("is allowed for a member and only touches items of that bucket", async () => {
    const { owner, friend, bucketId, itemId } = await sharedBucket();
    const second = await seedItem(owner, bucketId, {
      title: "buy milk",
      deadline: new Date(NOW.getTime() + 2 * HOUR),
    });
    const elsewhere = await seedBucket(owner);
    const foreign = await seedItem(owner, elsewhere, {
      title: "not shared",
      deadline: new Date(NOW.getTime() + 3 * HOUR),
    });
    await db.update(items).set({ sortOrder: 7 }).where(eq(items.id, foreign));
    session.userId = friend;

    expect(await reorderItemsAction(bucketId, [second, foreign, itemId])).toEqual({ ok: true });

    const shared = await db
      .select({ id: items.id })
      .from(items)
      .where(eq(items.bucketId, bucketId))
      .orderBy(asc(items.sortOrder));
    expect(shared.map((row) => row.id)).toEqual([second, itemId]);
    expect((await itemOf(foreign)).sortOrder).toBe(7);
  });

  it("is refused for someone outside the bucket", async () => {
    const { stranger, bucketId, itemId } = await sharedBucket();
    const before = (await itemOf(itemId)).sortOrder;
    session.userId = stranger;

    expect(await reorderItemsAction(bucketId, [itemId])).toEqual({
      ok: false,
      error: "Bucket not found",
    });
    expect((await itemOf(itemId)).sortOrder).toBe(before);
  });
});

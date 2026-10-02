import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, items } from "@/lib/db/schema";
import {
  deleteItemForever,
  emptyTrash,
  listTrash,
  purgeOldTrash,
  restoreItem,
} from "@/lib/items/trash";
import {
  HOUR,
  remindersQueued,
  resetSchedulerEnvironment,
  runSchedulerAt,
  seedBucket,
  seedItem,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

const T0 = new Date("2026-03-10T12:00:00Z");
const DAY = 24 * HOUR;

beforeEach(() => useSchedulerEnvironment(T0));
afterEach(() => resetSchedulerEnvironment());

async function trashItem(itemId: number, at = T0) {
  await db.update(items).set({ deletedAt: at }).where(eq(items.id, itemId));
}

async function trashBucket(bucketId: number, at = T0) {
  await db.update(buckets).set({ deletedAt: at }).where(eq(buckets.id, bucketId));
}

const exists = async (id: number) =>
  (await db.select().from(items).where(eq(items.id, id))).length === 1;

describe("restoring an item", () => {
  it("puts it back with its reminder", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);
    const itemId = await seedItem(userId, bucketId, { deadline: new Date(T0.getTime() + DAY) });
    await trashItem(itemId);

    expect(await restoreItem(userId, itemId, T0)).toBe(true);
    const item = await db.query.items.findFirst({ where: eq(items.id, itemId) });
    expect(item?.deletedAt).toBeNull();
    expect(item?.nextReminderAt).toEqual(new Date(T0.getTime() + DAY));
  });

  it("doesn't send a late 'due now' when its date passed while in the trash", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);
    const itemId = await seedItem(userId, bucketId, { deadline: new Date(T0.getTime() + DAY) });
    await trashItem(itemId);

    const weekLater = new Date(T0.getTime() + 7 * DAY);
    await restoreItem(userId, itemId, weekLater);
    await runSchedulerAt(new Date(weekLater.getTime() + 60_000));
    expect(await remindersQueued(itemId)).toBe(0);
  });

  it("only works on the user's own items that are in the trash", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);
    const itemId = await seedItem(userId, bucketId, { deadline: T0 });
    expect(await restoreItem(userId, itemId)).toBe(false);
    await trashItem(itemId);
    expect(await restoreItem(await seedUser(), itemId)).toBe(false);
  });
});

describe("the trash list", () => {
  it("shows trashed buckets with their item counts and trashed items with their bucket", async () => {
    const userId = await seedUser();
    const kept = await seedBucket(userId);
    const gone = await seedBucket(userId);
    const loose = await seedItem(userId, kept, { deadline: T0, title: "pay rent" });
    const inside = await seedItem(userId, gone, { deadline: T0, title: "inside" });
    await seedItem(userId, gone, { deadline: T0 });
    await trashItem(loose);
    await trashItem(inside);
    await trashBucket(gone);
    await trashItem(await seedItem(await seedUser(), kept, { deadline: T0 }));

    const trash = await listTrash(userId);
    expect(trash.buckets).toMatchObject([{ id: gone, itemCount: 2 }]);
    expect(trash.items.map((i) => [i.title, i.bucketInTrash]).sort()).toEqual([
      ["inside", true],
      ["pay rent", false],
    ]);
  });
});

describe("deleting for good", () => {
  it("deletes only the user's own trashed items", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);
    const active = await seedItem(userId, bucketId, { deadline: T0 });
    const trashed = await seedItem(userId, bucketId, { deadline: T0 });
    await trashItem(trashed);

    await deleteItemForever(userId, active);
    await deleteItemForever(await seedUser(), trashed);
    expect([await exists(active), await exists(trashed)]).toEqual([true, true]);

    await deleteItemForever(userId, trashed);
    expect(await exists(trashed)).toBe(false);
  });

  it("empty trash removes the user's trashed buckets and items, nothing else", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);
    const gone = await seedBucket(userId);
    const active = await seedItem(userId, bucketId, { deadline: T0 });
    const trashed = await seedItem(userId, bucketId, { deadline: T0 });
    const inGone = await seedItem(userId, gone, { deadline: T0 });
    await trashItem(trashed);
    await trashBucket(gone);
    const otherUser = await seedUser();
    const theirs = await seedItem(otherUser, await seedBucket(otherUser), { deadline: T0 });
    await trashItem(theirs);

    await emptyTrash(userId);
    expect([await exists(active), await exists(trashed), await exists(inGone)]).toEqual([
      true,
      false,
      false,
    ]);
    expect(await exists(theirs)).toBe(true);
  });

  it("the daily cleanup removes what has been in the trash over 30 days", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);
    const old = await seedItem(userId, bucketId, { deadline: T0 });
    const recent = await seedItem(userId, bucketId, { deadline: T0 });
    const active = await seedItem(userId, bucketId, { deadline: T0 });
    await trashItem(old, new Date(T0.getTime() - 31 * DAY));
    await trashItem(recent, new Date(T0.getTime() - 29 * DAY));
    const oldBucket = await seedBucket(userId);
    const inOldBucket = await seedItem(userId, oldBucket, { deadline: T0 });
    await trashBucket(oldBucket, new Date(T0.getTime() - 31 * DAY));

    await purgeOldTrash(T0);

    expect([await exists(old), await exists(recent), await exists(active)]).toEqual([
      false,
      true,
      true,
    ]);
    expect(await exists(inOldBucket)).toBe(false);
  });
});

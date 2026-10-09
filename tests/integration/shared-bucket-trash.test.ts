import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as SessionModule from "@/lib/auth/session";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bucketMembers, buckets, items, users } from "@/lib/db/schema";
import { deleteItemAction } from "@/app/(app)/item-actions";
import {
  deleteItemForeverAction,
  emptyTrashAction,
  getTrashAction,
  restoreItemAction,
} from "@/app/(app)/trash-actions";
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

beforeEach(() => useSchedulerEnvironment(NOW));
afterEach(() => resetSchedulerEnvironment());

async function sharedBucket() {
  const owner = await seedUser();
  const member = await seedUser();
  const stranger = await seedUser();
  await db.update(users).set({ displayName: "Sam" }).where(eq(users.id, member));
  const bucketId = await seedBucket(owner);
  await db.insert(bucketMembers).values({ bucketId, userId: member });
  const itemId = await seedItem(owner, bucketId, {
    title: "buy milk",
    deadline: new Date(NOW.getTime() + HOUR),
  });
  return { owner, member, stranger, bucketId, itemId };
}

async function trashFor(userId: number) {
  session.userId = userId;
  const result = await getTrashAction();
  if (!result.ok) throw new Error(result.error);
  return result;
}

async function itemOf(itemId: number) {
  const [row] = await db.select().from(items).where(eq(items.id, itemId));
  return row;
}

describe("the trash of a shared bucket", () => {
  it("shows an item a member deleted to everyone in the bucket, with who deleted it", async () => {
    const { owner, member, itemId } = await sharedBucket();
    session.userId = member;
    expect(await deleteItemAction(itemId)).toEqual({ ok: true });

    const forOwner = (await trashFor(owner)).items;
    expect(forOwner).toMatchObject([{ id: itemId, deletedBy: "Sam", canDelete: true }]);
    const forMember = (await trashFor(member)).items;
    expect(forMember).toMatchObject([{ id: itemId, deletedBy: "you", canDelete: false }]);
  });

  it("is empty for someone outside the bucket", async () => {
    const { member, stranger, itemId } = await sharedBucket();
    session.userId = member;
    await deleteItemAction(itemId);

    expect(await trashFor(stranger)).toMatchObject({ buckets: [], items: [] });
  });

  it("does not say who deleted an item in a bucket nobody else is in", async () => {
    const owner = await seedUser();
    const bucketId = await seedBucket(owner);
    const itemId = await seedItem(owner, bucketId, { deadline: NOW });
    session.userId = owner;
    await deleteItemAction(itemId);

    expect((await trashFor(owner)).items).toMatchObject([{ id: itemId, deletedBy: null }]);
  });

  it("keeps a deleted bucket and its trashed items out of its members' trash", async () => {
    const { owner, member, bucketId, itemId } = await sharedBucket();
    session.userId = member;
    await deleteItemAction(itemId);
    await db.update(buckets).set({ deletedAt: NOW }).where(eq(buckets.id, bucketId));

    expect(await trashFor(member)).toMatchObject({ buckets: [], items: [] });
    const forOwner = await trashFor(owner);
    expect(forOwner.buckets).toMatchObject([{ id: bucketId }]);
    expect(forOwner.items).toMatchObject([{ id: itemId, bucketInTrash: true }]);
  });
});

describe("restoring from a shared trash", () => {
  it("lets any member bring an item back, and forgets who deleted it", async () => {
    const { owner, member, itemId } = await sharedBucket();
    session.userId = owner;
    await deleteItemAction(itemId);

    session.userId = member;
    expect(await restoreItemAction(itemId)).toEqual({ ok: true });

    expect(await itemOf(itemId)).toMatchObject({ deletedAt: null, deletedBy: null });
  });

  it("is refused for someone outside the bucket", async () => {
    const { owner, stranger, itemId } = await sharedBucket();
    session.userId = owner;
    await deleteItemAction(itemId);

    session.userId = stranger;
    expect(await restoreItemAction(itemId)).toMatchObject({ ok: false });
    expect((await itemOf(itemId)).deletedAt).not.toBeNull();
  });
});

describe("deleting forever from a shared trash", () => {
  it("is for the owner only", async () => {
    const { owner, member, stranger, itemId } = await sharedBucket();
    session.userId = member;
    await deleteItemAction(itemId);

    expect(await deleteItemForeverAction(itemId)).toEqual({
      ok: false,
      error: "Only the owner can delete items forever",
    });
    session.userId = stranger;
    expect(await deleteItemForeverAction(itemId)).toEqual({
      ok: false,
      error: "Item not found in trash",
    });
    expect(await itemOf(itemId)).toBeDefined();

    session.userId = owner;
    expect(await deleteItemForeverAction(itemId)).toEqual({ ok: true });
    expect(await itemOf(itemId)).toBeUndefined();
  });

  it("is the same for emptying the trash: a member only empties their own buckets", async () => {
    const { owner, member, itemId } = await sharedBucket();
    session.userId = member;
    await deleteItemAction(itemId);
    const memberBucket = await seedBucket(member);
    const memberItem = await seedItem(member, memberBucket, { deadline: NOW });
    await db.update(items).set({ deletedAt: NOW }).where(eq(items.id, memberItem));

    expect(await emptyTrashAction()).toEqual({ ok: true });
    expect(await itemOf(itemId)).toBeDefined();
    expect(await itemOf(memberItem)).toBeUndefined();

    session.userId = owner;
    expect(await emptyTrashAction()).toEqual({ ok: true });
    expect(await itemOf(itemId)).toBeUndefined();
  });
});

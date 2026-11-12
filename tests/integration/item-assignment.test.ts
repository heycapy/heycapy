import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as SessionModule from "@/lib/auth/session";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bucketMembers, itemAssignees, items, users } from "@/lib/db/schema";
import { ITEM_STATUS } from "@/constants";
import {
  addItemAction,
  assignItemAction,
  completeItemAction,
  updateItemAction,
} from "@/app/(app)/item-actions";
import { leaveBucket, removeMember } from "@/lib/buckets/members";
import { deleteAccount } from "@/lib/account/delete";
import { executeToolCall } from "@/lib/ai/capyTools";
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
  const member = await seedUser();
  const stranger = await seedUser();
  const bucketId = await seedBucket(owner);
  await db.insert(bucketMembers).values({ bucketId, userId: member });
  const itemId = await seedItem(owner, bucketId, {
    title: "take out the bins",
    deadline: new Date(NOW.getTime() + HOUR),
  });
  return { owner, member, stranger, bucketId, itemId };
}

async function assigneesOf(itemId: number) {
  const rows = await db
    .select({ userId: itemAssignees.userId })
    .from(itemAssignees)
    .where(eq(itemAssignees.itemId, itemId))
    .orderBy(itemAssignees.id);
  return rows.map((r) => r.userId);
}

async function assign(itemId: number, ...userIds: number[]) {
  await db.delete(itemAssignees).where(eq(itemAssignees.itemId, itemId));
  if (userIds.length > 0) {
    await db.insert(itemAssignees).values(userIds.map((userId) => ({ itemId, userId })));
  }
}

async function idOf(bucketId: number, title: string) {
  const [row] = await db
    .select({ id: items.id })
    .from(items)
    .where(and(eq(items.bucketId, bucketId), eq(items.title, title)));
  return row?.id ?? 0;
}

describe("assigning an item", () => {
  it("can be done when adding, to any members, by any member", async () => {
    const { owner, member, bucketId } = await sharedBucket();
    session.userId = member;

    await addItemAction(bucketId, "buy milk", null, undefined, null, null, null, [owner]);
    await addItemAction(bucketId, "water plants", null, undefined, null, null, null, [
      owner,
      member,
    ]);
    await addItemAction(bucketId, "nobody in particular", null, undefined, null, null, null, []);

    expect(await assigneesOf(await idOf(bucketId, "buy milk"))).toEqual([owner]);
    expect(await assigneesOf(await idOf(bucketId, "water plants"))).toEqual([owner, member]);
    expect(await assigneesOf(await idOf(bucketId, "nobody in particular"))).toEqual([]);
  });

  it("goes to everyone in the bucket when adding says nothing about it", async () => {
    const { owner, member, bucketId } = await sharedBucket();
    session.userId = member;

    await addItemAction(bucketId, "everyone's chore", null);

    expect((await assigneesOf(await idOf(bucketId, "everyone's chore"))).sort()).toEqual(
      [owner, member].sort()
    );
  });

  it("can be changed, cleared, and left alone when an update says nothing about it", async () => {
    const { owner, member, itemId } = await sharedBucket();
    session.userId = owner;

    await updateItemAction(
      itemId,
      "take out the bins",
      null,
      undefined,
      undefined,
      undefined,
      undefined,
      [owner, member]
    );
    expect(await assigneesOf(itemId)).toEqual([owner, member]);

    await updateItemAction(itemId, "take out the bins!", null);
    expect(await assigneesOf(itemId)).toEqual([owner, member]);

    await updateItemAction(
      itemId,
      "take out the bins",
      null,
      undefined,
      undefined,
      undefined,
      undefined,
      []
    );
    expect(await assigneesOf(itemId)).toEqual([]);
  });

  it("is refused for someone who isn't in the bucket, and nothing changes", async () => {
    const { owner, stranger, bucketId, itemId } = await sharedBucket();
    const before = await assigneesOf(itemId);
    session.userId = owner;

    expect(
      await addItemAction(bucketId, "new", null, undefined, null, null, null, [owner, stranger])
    ).toEqual({ ok: false, error: "That person isn't in this bucket" });
    expect(
      await updateItemAction(itemId, "x", null, undefined, undefined, undefined, undefined, [
        stranger,
      ])
    ).toEqual({ ok: false, error: "That person isn't in this bucket" });
    expect(await assignItemAction(itemId, [stranger])).toEqual({
      ok: false,
      error: "That person isn't in this bucket",
    });
    expect(await db.select().from(items).where(eq(items.title, "new"))).toEqual([]);
    expect(await assigneesOf(itemId)).toEqual(before);
  });

  it("stays on the next occurrence of a repeating item", async () => {
    const { owner, member, bucketId, itemId } = await sharedBucket();
    await db.update(items).set({ recurring: WEEKLY }).where(eq(items.id, itemId));
    await assign(itemId, owner, member);
    session.userId = owner;

    expect(await completeItemAction(itemId)).toEqual({ ok: true });

    const rows = await db.select().from(items).where(eq(items.bucketId, bucketId));
    const next = rows.find((r) => r.id !== itemId && r.status !== ITEM_STATUS.completed);
    expect(next?.title).toBe("take out the bins");
    expect(await assigneesOf(next?.id ?? 0)).toEqual([owner, member]);
  });
});

describe("when an assignee goes away", () => {
  it("leaving or being removed takes them off their items only", async () => {
    const { owner, member, bucketId, itemId } = await sharedBucket();
    const other = await seedUser();
    await db.insert(bucketMembers).values({ bucketId, userId: other });
    const theirs = await seedItem(owner, bucketId, { deadline: NOW });
    const ownersOwn = await seedItem(owner, bucketId, { deadline: NOW });
    await assign(itemId, member, owner);
    await assign(theirs, other, member);
    await assign(ownersOwn, owner);

    expect(removeMember(owner, bucketId, member)).toEqual({ ok: true });
    expect([
      await assigneesOf(itemId),
      await assigneesOf(theirs),
      await assigneesOf(ownersOwn),
    ]).toEqual([[owner], [other], [owner]]);

    expect(leaveBucket(other, bucketId)).toEqual({ ok: true });
    expect(await assigneesOf(theirs)).toEqual([]);
    expect(await assigneesOf(ownersOwn)).toEqual([owner]);
  });

  it("deleting their account keeps the item for the others", async () => {
    const { owner, member, itemId } = await sharedBucket();
    await assign(itemId, owner, member);
    const row = await db.query.users.findFirst({ where: eq(users.id, member) });

    expect(deleteAccount(member, row?.email ?? "")).toEqual([]);

    expect(await assigneesOf(itemId)).toEqual([owner]);
  });

  it("moving an item to another bucket with capy assigns everyone in that bucket", async () => {
    const { owner, member, itemId } = await sharedBucket();
    const elsewhere = await seedBucket(owner);
    await assign(itemId, member);

    const call = {
      id: "call",
      name: "move_item",
      arguments: { item_id: itemId, bucket_id: elsewhere },
    };
    const result = JSON.parse(await executeToolCall(call, owner, "UTC", 1)) as { ok: boolean };

    expect(result.ok).toBe(true);
    expect(await assigneesOf(itemId)).toEqual([owner]);
  });
});

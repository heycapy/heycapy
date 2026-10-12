import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as SessionModule from "@/lib/auth/session";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bucketMembers, items, users } from "@/lib/db/schema";
import { ITEM_STATUS } from "@/constants";
import { addItemAction, completeItemAction, updateItemAction } from "@/app/(app)/item-actions";
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

async function assigneeOf(itemId: number) {
  const [row] = await db
    .select({ assigneeId: items.assigneeId })
    .from(items)
    .where(eq(items.id, itemId));
  return row?.assigneeId;
}

describe("assigning an item", () => {
  it("can be done when adding, to any member, by any member", async () => {
    const { owner, member, bucketId } = await sharedBucket();
    session.userId = member;

    await addItemAction(bucketId, "buy milk", null, undefined, null, null, null, owner);
    await addItemAction(bucketId, "water plants", null, undefined, null, null, null, member);
    await addItemAction(bucketId, "anyone can do this", null);

    const rows = await db.select().from(items).where(eq(items.bucketId, bucketId));
    const byTitle = Object.fromEntries(rows.map((r) => [r.title, r.assigneeId]));
    expect(byTitle).toMatchObject({
      "buy milk": owner,
      "water plants": member,
      "anyone can do this": null,
    });
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
      member
    );
    expect(await assigneeOf(itemId)).toBe(member);

    await updateItemAction(itemId, "take out the bins!", null);
    expect(await assigneeOf(itemId)).toBe(member);

    await updateItemAction(
      itemId,
      "take out the bins",
      null,
      undefined,
      undefined,
      undefined,
      undefined,
      null
    );
    expect(await assigneeOf(itemId)).toBeNull();
  });

  it("is refused for someone who isn't in the bucket, and nothing changes", async () => {
    const { owner, stranger, bucketId, itemId } = await sharedBucket();
    session.userId = owner;

    expect(
      await addItemAction(bucketId, "new", null, undefined, null, null, null, stranger)
    ).toEqual({ ok: false, error: "That person isn't in this bucket" });
    expect(
      await updateItemAction(
        itemId,
        "x",
        null,
        undefined,
        undefined,
        undefined,
        undefined,
        stranger
      )
    ).toEqual({ ok: false, error: "That person isn't in this bucket" });
    expect(await db.select().from(items).where(eq(items.title, "new"))).toEqual([]);
    expect(await assigneeOf(itemId)).toBeNull();
  });

  it("stays on the next occurrence of a repeating item", async () => {
    const { owner, member, bucketId, itemId } = await sharedBucket();
    await db
      .update(items)
      .set({ recurring: WEEKLY, assigneeId: member })
      .where(eq(items.id, itemId));
    session.userId = owner;

    expect(await completeItemAction(itemId)).toEqual({ ok: true });

    const rows = await db.select().from(items).where(eq(items.bucketId, bucketId));
    const next = rows.find((r) => r.id !== itemId && r.status !== ITEM_STATUS.completed);
    expect(next).toMatchObject({ title: "take out the bins", assigneeId: member });
  });
});

describe("when the assignee goes away", () => {
  it("leaving or being removed makes only their items unassigned", async () => {
    const { owner, member, bucketId, itemId } = await sharedBucket();
    const other = await seedUser();
    await db.insert(bucketMembers).values({ bucketId, userId: other });
    const theirs = await seedItem(owner, bucketId, { deadline: NOW });
    const ownersOwn = await seedItem(owner, bucketId, { deadline: NOW });
    await db.update(items).set({ assigneeId: member }).where(eq(items.id, itemId));
    await db.update(items).set({ assigneeId: other }).where(eq(items.id, theirs));
    await db.update(items).set({ assigneeId: owner }).where(eq(items.id, ownersOwn));

    expect(removeMember(owner, bucketId, member)).toEqual({ ok: true });
    expect([
      await assigneeOf(itemId),
      await assigneeOf(theirs),
      await assigneeOf(ownersOwn),
    ]).toEqual([null, other, owner]);

    expect(leaveBucket(other, bucketId)).toEqual({ ok: true });
    expect(await assigneeOf(theirs)).toBeNull();
    expect(await assigneeOf(ownersOwn)).toBe(owner);
  });

  it("deleting their account keeps the item, unassigned", async () => {
    const { member, itemId } = await sharedBucket();
    await db.update(items).set({ assigneeId: member }).where(eq(items.id, itemId));
    const row = await db.query.users.findFirst({ where: eq(users.id, member) });

    expect(deleteAccount(member, row?.email ?? "")).toEqual([]);

    expect(await assigneeOf(itemId)).toBeNull();
  });

  it("moving an item to another bucket with capy clears the assignee", async () => {
    const { owner, member, itemId } = await sharedBucket();
    const elsewhere = await seedBucket(owner);
    await db.update(items).set({ assigneeId: member }).where(eq(items.id, itemId));

    const call = {
      id: "call",
      name: "move_item",
      arguments: { item_id: itemId, bucket_id: elsewhere },
    };
    const result = JSON.parse(await executeToolCall(call, owner, "UTC", 1)) as { ok: boolean };

    expect(result.ok).toBe(true);
    expect(await assigneeOf(itemId)).toBeNull();
  });
});

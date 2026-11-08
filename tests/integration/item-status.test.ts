import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { ITEM_STATUS } from "@/constants";
import { addItemAction, updateItemAction } from "@/app/(app)/item-actions";
import {
  resetSchedulerEnvironment,
  seedBucket,
  seedItem,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

const session = vi.hoisted(() => ({ userId: 0, email: "" }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => session }));

const T0 = new Date("2026-03-10T12:00:00Z");

beforeEach(() => useSchedulerEnvironment(T0));
afterEach(() => resetSchedulerEnvironment());

async function setup() {
  const userId = await seedUser();
  session.userId = userId;
  const bucketId = await seedBucket(userId);
  const itemId = await seedItem(userId, bucketId, { deadline: T0 });
  return { bucketId, itemId };
}

async function statusOf(itemId: number) {
  const [row] = await db.select({ status: items.status }).from(items).where(eq(items.id, itemId));
  return row.status;
}

it("adding refuses a status the app doesn't know, or one only the scheduler sets", async () => {
  const { bucketId } = await setup();

  for (const status of ["anything", ITEM_STATUS.missed]) {
    const result = await addItemAction(bucketId, "pay rent", null, status);
    expect(result).toEqual({ ok: false, error: "Invalid status" });
  }
  const added = await addItemAction(bucketId, "pay rent", null, ITEM_STATUS.completed);
  expect(added.ok).toBe(true);
});

it("updating refuses an unknown status and leaves the item as it was", async () => {
  const { itemId } = await setup();

  const result = await updateItemAction(itemId, "pay rent", null, "anything");

  expect(result).toEqual({ ok: false, error: "Invalid status" });
  expect(await statusOf(itemId)).toBe(ITEM_STATUS.active);
});

it("a missed item can still be edited, but nothing can mark an item missed", async () => {
  const { itemId } = await setup();

  expect((await updateItemAction(itemId, "pay rent", null, ITEM_STATUS.missed)).ok).toBe(false);

  await db.update(items).set({ status: ITEM_STATUS.missed }).where(eq(items.id, itemId));
  const edited = await updateItemAction(itemId, "pay the rent", null, ITEM_STATUS.missed);
  expect(edited.ok).toBe(true);
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, items } from "@/lib/db/schema";
import { executeToolCall } from "@/lib/ai/capyTools";
import { DELETE_CONFIRM_TTL_MS } from "@/constants";
import { confirmDelete } from "@/lib/ai/deleteGuard";
import {
  resetSchedulerEnvironment,
  seedBucket,
  seedItem,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

const T0 = new Date("2026-03-10T12:00:00Z");

beforeEach(() => useSchedulerEnvironment(T0));
afterEach(() => resetSchedulerEnvironment());

async function deleteBucket(userId: number, bucketId: number, turnId: number) {
  const call = { id: "call", name: "delete_bucket", arguments: { bucket_id: bucketId } };
  return JSON.parse(await executeToolCall(call, userId, "UTC", turnId)) as {
    ok: boolean;
    needsConfirmation?: boolean;
  };
}

async function isDeleted(bucketId: number) {
  const [row] = await db.select().from(buckets).where(eq(buckets.id, bucketId));
  return row.deletedAt !== null;
}

describe("capy deleting a bucket", () => {
  it("asks first and deletes only on a call from a later message", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);

    expect(await deleteBucket(userId, bucketId, 1)).toMatchObject({ needsConfirmation: true });
    expect(await isDeleted(bucketId)).toBe(false);

    expect(await deleteBucket(userId, bucketId, 2)).toEqual({ ok: true });
    expect(await isDeleted(bucketId)).toBe(true);
  });

  it("does not delete when the model calls twice in the same message", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);

    await deleteBucket(userId, bucketId, 1);
    expect(await deleteBucket(userId, bucketId, 1)).toMatchObject({ needsConfirmation: true });
    expect(await isDeleted(bucketId)).toBe(false);
  });

  it("asks again once the question has expired", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);

    await deleteBucket(userId, bucketId, 1);
    vi.setSystemTime(new Date(T0.getTime() + DELETE_CONFIRM_TTL_MS + 1));
    expect(await deleteBucket(userId, bucketId, 2)).toMatchObject({ needsConfirmation: true });
    expect(await isDeleted(bucketId)).toBe(false);
  });

  it("keeps a question about one bucket from confirming another", async () => {
    const userId = await seedUser();
    const first = await seedBucket(userId);
    const second = await seedBucket(userId);

    await deleteBucket(userId, first, 1);
    expect(await deleteBucket(userId, second, 2)).toMatchObject({ needsConfirmation: true });
    expect(await isDeleted(second)).toBe(false);
  });
});

async function deleteItem(userId: number, itemId: number, turnId: number) {
  const call = { id: "call", name: "delete_item", arguments: { item_id: itemId } };
  return JSON.parse(await executeToolCall(call, userId, "UTC", turnId)) as {
    ok: boolean;
    needsConfirmation?: boolean;
    error?: string;
  };
}

async function isItemDeleted(itemId: number) {
  const [row] = await db.select().from(items).where(eq(items.id, itemId));
  return row.deletedAt !== null;
}

describe("capy deleting an item", () => {
  it("asks first, naming the item, and deletes only on a call from a later message", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);
    const itemId = await seedItem(userId, bucketId, { deadline: T0, title: "Hotstar" });

    const asked = await deleteItem(userId, itemId, 1);
    expect(asked).toMatchObject({ ok: false, needsConfirmation: true });
    expect(asked.error).toContain('"Hotstar"');
    expect(await isItemDeleted(itemId)).toBe(false);

    expect(await deleteItem(userId, itemId, 2)).toEqual({ ok: true });
    expect(await isItemDeleted(itemId)).toBe(true);
  });

  it("does not delete when the model calls twice in the same message", async () => {
    const userId = await seedUser();
    const itemId = await seedItem(userId, await seedBucket(userId), { deadline: T0 });

    await deleteItem(userId, itemId, 1);
    expect(await deleteItem(userId, itemId, 1)).toMatchObject({ needsConfirmation: true });
    expect(await isItemDeleted(itemId)).toBe(false);
  });

  it("keeps a question about one item from confirming another", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);
    const first = await seedItem(userId, bucketId, { deadline: T0 });
    const second = await seedItem(userId, bucketId, { deadline: T0 });

    await deleteItem(userId, first, 1);
    expect(await deleteItem(userId, second, 2)).toMatchObject({ needsConfirmation: true });
    expect(await isItemDeleted(second)).toBe(false);
  });

  it("keeps a question about a bucket from confirming an item with the same id", () => {
    expect(confirmDelete(1, "bucket:5", 1)).toBe(false);
    expect(confirmDelete(1, "item:5", 2)).toBe(false);
  });
});

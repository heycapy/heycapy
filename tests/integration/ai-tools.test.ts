import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { executeToolCall } from "@/lib/ai/capyTools";
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

async function tool(userId: number, name: string, args: Record<string, unknown>) {
  return JSON.parse(await executeToolCall({ id: "call", name, arguments: args }, userId)) as {
    ok: boolean;
    itemId?: number;
    error?: string;
  };
}

async function savedItem(itemId: number) {
  const [row] = await db.select().from(items).where(eq(items.id, itemId));
  return row;
}

const SUBSCRIPTION_SCHEMA = {
  fields: [
    { key: "price", label: "price", type: "currency" },
    { key: "plan", label: "plan", type: "select", options: ["basic", "premium"] },
  ],
};

describe("update_item custom fields", () => {
  it("rejects values the bucket's fields don't allow", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId, undefined, SUBSCRIPTION_SCHEMA);
    const itemId = await seedItem(userId, bucketId, { deadline: new Date(T0.getTime() + HOUR) });

    const result = await tool(userId, "update_item", {
      item_id: itemId,
      properties: { plan: "ultra" },
    });

    expect(result.ok).toBe(false);
    expect((await savedItem(itemId)).properties).toBeNull();
  });

  it("changes only the fields it's given", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId, undefined, SUBSCRIPTION_SCHEMA);
    const { itemId } = await tool(userId, "add_item", {
      bucket_id: bucketId,
      title: "netflix",
      properties: { price: 15, plan: "basic" },
    });

    expect(
      await tool(userId, "update_item", { item_id: itemId, properties: { price: 18 } })
    ).toMatchObject({ ok: true });

    expect(JSON.parse((await savedItem(itemId ?? -1)).properties ?? "null")).toEqual({
      price: 18,
      plan: "basic",
    });
  });
});

describe("item statuses", () => {
  it("add_item rejects a status that doesn't exist", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);

    const result = await tool(userId, "add_item", {
      bucket_id: bucketId,
      title: "old taxes",
      status: "archived",
    });

    expect(result.ok).toBe(false);
    expect(await db.select().from(items).where(eq(items.bucketId, bucketId))).toHaveLength(0);
  });

  it("update_item rejects a status that doesn't exist", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);
    const itemId = await seedItem(userId, bucketId, { deadline: new Date(T0.getTime() + HOUR) });

    const result = await tool(userId, "update_item", { item_id: itemId, status: "in progress" });

    expect(result.ok).toBe(false);
    expect((await savedItem(itemId)).status).toBe("active");
  });

  it("update_item accepts on hold", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);
    const itemId = await seedItem(userId, bucketId, { deadline: new Date(T0.getTime() + HOUR) });

    expect(await tool(userId, "update_item", { item_id: itemId, status: "on hold" })).toMatchObject(
      { ok: true }
    );
    expect((await savedItem(itemId)).status).toBe("on hold");
  });
});

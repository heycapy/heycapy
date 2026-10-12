import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bucketMembers, buckets, items } from "@/lib/db/schema";
import { listLiveBuckets } from "@/lib/buckets/access";
import { executeToolCall, getUpcomingItems } from "@/lib/ai/capyTools";
import { buildSystemPrompt } from "@/lib/ai/systemPrompt";
import {
  HOUR,
  resetSchedulerEnvironment,
  seedBucket,
  seedItem,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

const NOW = new Date("2026-03-10T12:00:00Z");

beforeEach(() => useSchedulerEnvironment(NOW));
afterEach(() => resetSchedulerEnvironment());

async function sharedBucket() {
  const owner = await seedUser();
  const member = await seedUser();
  const stranger = await seedUser();
  const bucketId = await seedBucket(owner);
  await db.update(buckets).set({ name: "Home" }).where(eq(buckets.id, bucketId));
  await db.insert(bucketMembers).values({ bucketId, userId: member });
  const itemId = await seedItem(owner, bucketId, {
    title: "book flights",
    deadline: new Date(NOW.getTime() + HOUR),
  });
  return { owner, member, stranger, bucketId, itemId };
}

async function tool(userId: number, name: string, args: Record<string, unknown>) {
  return JSON.parse(await executeToolCall({ id: "t", name, arguments: args }, userId)) as {
    ok?: boolean;
    error?: string;
  } & Record<string, unknown>;
}

async function itemOf(itemId: number) {
  const [row] = await db.select().from(items).where(eq(items.id, itemId));
  return row;
}

describe("capy in a shared bucket", () => {
  it("knows a member's joined bucket and that only its owner can change it", async () => {
    const { owner, member, bucketId } = await sharedBucket();

    expect(await tool(member, "list_buckets", {})).toEqual([
      { id: bucketId, name: "Home", icon: null, owned: false },
    ]);
    expect(await tool(owner, "list_buckets", {})).toEqual([
      { id: bucketId, name: "Home", icon: null, owned: true },
    ]);
    const prompt = buildSystemPrompt(null, await listLiveBuckets(member), "", NOW);
    expect(prompt).toContain(
      `- "Home" (id: ${bucketId}) [joined: only its owner can change or delete it`
    );
  });

  it("shows a member everyone's items, and a stranger none", async () => {
    const { member, stranger, bucketId } = await sharedBucket();

    const listed = (await tool(member, "list_items", { bucket_id: bucketId })) as unknown as {
      title: string;
    }[];
    expect(listed.map((i) => i.title)).toEqual(["book flights"]);
    const found = (await tool(member, "search_items", { keyword: "flights" })) as unknown as {
      title: string;
    }[];
    expect(found.map((i) => i.title)).toEqual(["book flights"]);
    expect((await getUpcomingItems(member, "UTC")).map((i) => i.title)).toEqual(["book flights"]);

    expect(await tool(stranger, "list_items", { bucket_id: bucketId })).toEqual({
      ok: false,
      error: "Bucket not found",
    });
    expect(await tool(stranger, "search_items", { keyword: "flights" })).toEqual([]);
    expect(await getUpcomingItems(stranger, "UTC")).toEqual([]);
  });

  it("lets a member add, change, complete, move and delete items in it", async () => {
    const { member, bucketId, itemId } = await sharedBucket();
    const own = await seedBucket(member);

    const added = await tool(member, "add_item", { bucket_id: bucketId, title: "buy milk" });
    expect(added.ok).toBe(true);
    expect(await itemOf(Number(added.itemId))).toMatchObject({ bucketId, userId: member });

    expect((await tool(member, "update_item", { item_id: itemId, title: "book trains" })).ok).toBe(
      true
    );
    expect((await itemOf(itemId))?.title).toBe("book trains");

    expect(await tool(member, "complete_item", { item_id: itemId })).toEqual({
      ok: true,
      newStatus: "completed",
    });

    expect((await tool(member, "move_item", { item_id: itemId, bucket_id: own })).ok).toBe(true);
    expect((await itemOf(itemId))?.bucketId).toBe(own);

    const milk = Number(added.itemId);
    await tool(member, "delete_item", { item_id: milk });
    expect(await itemOf(milk)).toMatchObject({ deletedAt: NOW, deletedBy: member });
  });

  it("lets a stranger change nothing", async () => {
    const { owner, stranger, bucketId, itemId } = await sharedBucket();
    const strangers = await seedBucket(stranger);
    const notFound = { ok: false, error: "Item not found" };

    expect(await tool(stranger, "add_item", { bucket_id: bucketId, title: "x" })).toEqual({
      ok: false,
      error: "Bucket not found",
    });
    expect(await tool(stranger, "update_item", { item_id: itemId, title: "x" })).toEqual(notFound);
    expect(await tool(stranger, "complete_item", { item_id: itemId })).toEqual(notFound);
    expect(await tool(stranger, "delete_item", { item_id: itemId })).toEqual(notFound);
    expect(await tool(stranger, "move_item", { item_id: itemId, bucket_id: strangers })).toEqual(
      notFound
    );
    expect(await tool(owner, "move_item", { item_id: itemId, bucket_id: strangers })).toMatchObject(
      { ok: false, error: "Destination bucket not found" }
    );

    expect(await itemOf(itemId)).toMatchObject({
      title: "book flights",
      bucketId,
      status: "active",
      deletedAt: null,
    });
  });

  it("keeps the bucket itself to its owner", async () => {
    const { member, stranger, bucketId } = await sharedBucket();
    const ownerOnly = {
      ok: false,
      error: 'Only the owner of "Home" can change it or see its settings. Tell the user that.',
    };

    expect(await tool(member, "update_bucket", { bucket_id: bucketId, name: "Mine" })).toEqual(
      ownerOnly
    );
    expect(await tool(member, "delete_bucket", { bucket_id: bucketId })).toEqual(ownerOnly);
    expect(await tool(member, "get_bucket_settings", { bucket_id: bucketId })).toEqual(ownerOnly);
    expect(
      await tool(member, "update_bucket_settings", { bucket_id: bucketId, read_only: true })
    ).toEqual(ownerOnly);
    expect(await tool(stranger, "get_bucket_settings", { bucket_id: bucketId })).toEqual({
      ok: false,
      error: "Bucket not found",
    });

    const [bucket] = await db.select().from(buckets).where(eq(buckets.id, bucketId));
    expect(bucket).toMatchObject({ name: "Home", deletedAt: null });
  });
});

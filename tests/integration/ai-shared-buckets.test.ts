import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bucketMembers, buckets, items, users, userSettings } from "@/lib/db/schema";
import { listLiveBuckets } from "@/lib/buckets/access";
import { getMemberChannels } from "@/lib/notifications/channels";
import { parseItemsRules } from "@/lib/rules";
import { executeToolCall, getUpcomingItems } from "@/lib/ai/capyTools";
import { withMemberNames } from "@/lib/ai/assigneeArgs";
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

async function tool(userId: number, name: string, args: Record<string, unknown>, timezone = "UTC") {
  return JSON.parse(
    await executeToolCall({ id: "t", name, arguments: args }, userId, timezone)
  ) as {
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
      error: 'Only the owner of "Home" can change it. Tell the user that.',
    };

    expect(await tool(member, "update_bucket", { bucket_id: bucketId, name: "Mine" })).toEqual(
      ownerOnly
    );
    expect(await tool(member, "delete_bucket", { bucket_id: bucketId })).toEqual(ownerOnly);
    expect(
      await tool(member, "update_bucket_settings", {
        bucket_id: bucketId,
        read_only: true,
        channels: ["email"],
      })
    ).toEqual({
      ok: false,
      error:
        'Only the owner of "Home" can change its settings; the user can change only their own channels. Tell the user that.',
    });
    expect(await tool(stranger, "get_bucket_settings", { bucket_id: bucketId })).toEqual({
      ok: false,
      error: "Bucket not found",
    });
    expect(
      await tool(stranger, "update_bucket_settings", { bucket_id: bucketId, channels: ["email"] })
    ).toEqual({ ok: false, error: "Bucket not found" });

    const [bucket] = await db.select().from(buckets).where(eq(buckets.id, bucketId));
    expect(bucket).toMatchObject({ name: "Home", deletedAt: null });
    expect(parseItemsRules(bucket.itemsRules).readonly).not.toBe(true);
    expect(await getMemberChannels(member, bucketId)).toMatchObject({ medium: [] });
  });

  it("lets a member read the bucket's settings and change only their own channels", async () => {
    const { owner, member, bucketId } = await sharedBucket();
    const ownerBefore = await getMemberChannels(owner, bucketId);

    expect(await tool(member, "get_bucket_settings", { bucket_id: bucketId })).toMatchObject({
      ok: true,
      settings: { bucket_id: bucketId, name: "Home", is_owner: false, deadline_repeat: "once" },
    });
    expect(
      await tool(member, "update_bucket_settings", { bucket_id: bucketId, channels: ["email"] })
    ).toMatchObject({ ok: true, settings: { channels: ["email"], is_owner: false } });

    expect(await getMemberChannels(member, bucketId)).toEqual({
      medium: ["email"],
      webhooks: [],
      followsTweaks: false,
    });
    expect(await getMemberChannels(owner, bucketId)).toEqual(ownerBefore);
  });
});

const INDIA = "Asia/Kolkata";
const LONDON = "Europe/London";

// An India owner and Sam in London, in March London is on UTC, India 5:30 ahead
async function acrossClocks() {
  const owner = await seedUser(INDIA);
  const sam = await seedUser(LONDON);
  const bucketId = await seedBucket(owner);
  await db.update(buckets).set({ name: "Home" }).where(eq(buckets.id, bucketId));
  const ownerUsername = `quiet-otter-${owner}`;
  const samUsername = `sam_${sam}`;
  await db.update(users).set({ username: ownerUsername }).where(eq(users.id, owner));
  await db.update(users).set({ username: samUsername }).where(eq(users.id, sam));
  await db.insert(bucketMembers).values({ bucketId, userId: sam });
  return { owner, sam, bucketId, ownerUsername, samUsername };
}

type SavedItem = { item: Record<string, unknown>; itemId: number } & Record<string, unknown>;

async function addAs(userId: number, args: Record<string, unknown>) {
  return (await tool(userId, "add_item", { title: "call mum", ...args }, INDIA)) as SavedItem;
}

describe("capy assigning items", () => {
  it("assigns by username and reads the time on that person's clock", async () => {
    const { owner, sam, bucketId, samUsername } = await acrossClocks();

    const added = await addAs(owner, {
      bucket_id: bucketId,
      assignee: samUsername,
      deadline: "2026-03-11T09:00:00",
    });

    expect(await itemOf(added.itemId)).toMatchObject({
      assigneeId: sam,
      deadline: new Date("2026-03-11T09:00:00Z"),
      deadlineTimezone: LONDON,
    });
    expect(added.item).toMatchObject({
      assignedTo: samUsername,
      deadline: "Wed 2026-03-11 14:30",
      deadlineOtherClock: `Wed 2026-03-11 09:00 for ${samUsername}`,
    });
  });

  it("matches the username in any case, and keeps the user's clock when asked", async () => {
    const { owner, sam, bucketId, samUsername } = await acrossClocks();

    const added = await addAs(owner, {
      bucket_id: bucketId,
      assignee: samUsername.toUpperCase(),
      deadline: "2026-03-11T09:00:00",
      deadline_on_my_clock: true,
    });

    expect(await itemOf(added.itemId)).toMatchObject({
      assigneeId: sam,
      deadline: new Date("2026-03-11T03:30:00Z"),
      deadlineTimezone: INDIA,
    });
    expect(added.item).toMatchObject({
      deadlineOtherClock: `Wed 2026-03-11 03:30 for ${samUsername}`,
    });
  });

  it("takes me and anyone, on the user's own clock", async () => {
    const { owner, bucketId } = await acrossClocks();

    const mine = await addAs(owner, {
      bucket_id: bucketId,
      assignee: "me",
      deadline: "2026-03-11T09:00:00",
    });
    expect(await itemOf(mine.itemId)).toMatchObject({
      assigneeId: owner,
      deadline: new Date("2026-03-11T03:30:00Z"),
      deadlineTimezone: INDIA,
    });
    expect(mine.item).toMatchObject({ assignedTo: "the user", deadlineOtherClock: null });

    const cleared = (await tool(
      owner,
      "update_item",
      { item_id: mine.itemId, assignee: "anyone" },
      INDIA
    )) as SavedItem;
    expect(cleared.item).toMatchObject({ assignedTo: null });
    expect((await itemOf(mine.itemId))?.assigneeId).toBeNull();
  });

  it("refuses a name that isn't in the bucket, and any name in a bucket nobody shares", async () => {
    const { owner, bucketId, samUsername } = await acrossClocks();

    expect(await addAs(owner, { bucket_id: bucketId, assignee: "Bob" })).toEqual({
      ok: false,
      error: `No one called "Bob" in "Home". Its members: the user, ${samUsername}. Ask the user who they mean.`,
    });

    const solo = await seedBucket(owner);
    await db.update(buckets).set({ name: "Mine" }).where(eq(buckets.id, solo));
    expect(await addAs(owner, { bucket_id: solo, assignee: "me" })).toEqual({
      ok: false,
      error: `"Mine" isn't shared with anyone, so its items can't be assigned.`,
    });

    const saved = await db.select().from(items).where(eq(items.bucketId, bucketId));
    expect(saved).toEqual([]);
  });

  it("keeps the deadline when only the assignee changes, and reads a new time on theirs", async () => {
    const { owner, sam, bucketId, samUsername } = await acrossClocks();
    const added = await addAs(owner, { bucket_id: bucketId, deadline: "2026-03-11T09:00:00" });
    const onIndia = { deadline: new Date("2026-03-11T03:30:00Z"), deadlineTimezone: INDIA };
    expect(await itemOf(added.itemId)).toMatchObject(onIndia);

    await tool(owner, "update_item", { item_id: added.itemId, assignee: samUsername }, INDIA);
    expect(await itemOf(added.itemId)).toMatchObject({ ...onIndia, assigneeId: sam });

    await tool(
      owner,
      "update_item",
      { item_id: added.itemId, deadline: "2026-03-12T09:00:00" },
      INDIA
    );
    expect(await itemOf(added.itemId)).toMatchObject({
      deadline: new Date("2026-03-12T09:00:00Z"),
      deadlineTimezone: LONDON,
    });
  });

  it("uses the user's clock for someone whose timezone isn't set", async () => {
    const { owner, sam, bucketId, samUsername } = await acrossClocks();
    await db.update(userSettings).set({ timezone: "UTC" }).where(eq(userSettings.userId, sam));

    const added = await addAs(owner, {
      bucket_id: bucketId,
      assignee: samUsername,
      deadline: "2026-03-11T09:00:00",
    });
    expect(await itemOf(added.itemId)).toMatchObject({
      deadline: new Date("2026-03-11T03:30:00Z"),
      deadlineTimezone: INDIA,
    });
  });

  it("names the members of shared buckets in the prompt", async () => {
    const { owner, sam, bucketId, ownerUsername, samUsername } = await acrossClocks();
    const solo = await seedBucket(owner);
    await db.update(buckets).set({ name: "Mine" }).where(eq(buckets.id, solo));

    const ownerPrompt = buildSystemPrompt(
      null,
      await withMemberNames(owner, await listLiveBuckets(owner)),
      "",
      NOW
    );
    expect(ownerPrompt).toContain(
      `- "Home" (id: ${bucketId}) [members: me (the user), ${samUsername}`
    );
    expect(ownerPrompt).toMatch(new RegExp(`- "Mine" \\(id: ${solo}\\)(?! \\[members)`));

    const samPrompt = buildSystemPrompt(
      null,
      await withMemberNames(sam, await listLiveBuckets(sam)),
      "",
      NOW
    );
    expect(samPrompt).toContain(`members: ${ownerUsername}, me (the user)`);
  });
});

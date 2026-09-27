import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { executeToolCall } from "@/lib/ai/capyTools";
import { createItem, softDeleteItemById } from "@/app/api/telegram/telegram-utils";
import { reconcile } from "@/lib/reminders/refresh";
import {
  HOUR,
  MINUTE,
  remindersQueued,
  resetSchedulerEnvironment,
  runSchedulerAt,
  seedBucket,
  seedItem,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

const T0 = new Date("2026-03-10T12:00:00Z");

beforeEach(() => useSchedulerEnvironment(T0));
afterEach(() => resetSchedulerEnvironment());

async function tool(userId: number, name: string, args: Record<string, unknown>) {
  const result = JSON.parse(await executeToolCall({ id: "call", name, arguments: args }, userId));
  expect(result).toMatchObject({ ok: true });
  return result as { ok: true; itemId?: number };
}

async function itemsInBucket(bucketId: number) {
  return db.select().from(items).where(eq(items.bucketId, bucketId));
}

describe("items created outside the web UI get reminders", () => {
  it("assistant: add_item", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);
    const deadline = new Date(T0.getTime() + HOUR);
    const { itemId } = await tool(userId, "add_item", {
      bucket_id: bucketId,
      title: "call the bank",
      deadline: deadline.toISOString(),
    });

    await runSchedulerAt(new Date(deadline.getTime() + MINUTE));
    expect(await remindersQueued(itemId ?? -1)).toBe(1);
  });

  it("telegram: createItem", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);
    const deadline = new Date(T0.getTime() + HOUR);
    await createItem(userId, bucketId, "buy milk", deadline);
    const [created] = await itemsInBucket(bucketId);

    await runSchedulerAt(new Date(deadline.getTime() + MINUTE));
    expect(await remindersQueued(created.id)).toBe(1);
  });
});

describe("items closed outside the web UI stop reminding", () => {
  it("assistant: complete_item", async () => {
    const userId = await seedUser();
    const itemId = await seedItem(userId, await seedBucket(userId), {
      deadline: new Date(T0.getTime() + HOUR),
    });
    await tool(userId, "complete_item", { item_id: itemId });

    await runSchedulerAt(new Date(T0.getTime() + 2 * HOUR));
    expect(await remindersQueued(itemId)).toBe(0);
  });

  it("telegram: softDeleteItemById", async () => {
    const userId = await seedUser();
    const itemId = await seedItem(userId, await seedBucket(userId), {
      deadline: new Date(T0.getTime() + HOUR),
    });
    await softDeleteItemById(userId, itemId);

    await runSchedulerAt(new Date(T0.getTime() + 2 * HOUR));
    expect(await remindersQueued(itemId)).toBe(0);
  });
});

describe("recurring items", () => {
  it("the next occurrence is scheduled and reminded in turn", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);
    await tool(userId, "add_item", {
      bucket_id: bucketId,
      title: "water plants",
      deadline: T0.toISOString(),
      recurring_frequency: "daily",
    });
    const [first] = await itemsInBucket(bucketId);

    await runSchedulerAt(new Date(T0.getTime() + MINUTE));
    expect(await remindersQueued(first.id)).toBe(1);

    const [next] = await db
      .select()
      .from(items)
      .where(and(eq(items.bucketId, bucketId), ne(items.id, first.id)));
    expect(next.deadline?.toISOString()).toBe("2026-03-11T12:00:00.000Z");
    expect(next.nextReminderAt?.toISOString()).toBe("2026-03-11T12:00:00.000Z");

    await runSchedulerAt(new Date(T0.getTime() + 24 * HOUR + MINUTE));
    expect(await remindersQueued(next.id)).toBe(1);
  });
});

describe("safety net", () => {
  it("reconcile schedules an item written without a refresh", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);
    const [raw] = await db
      .insert(items)
      .values({ bucketId, userId, title: "written directly", deadline: T0 })
      .returning();
    expect(raw.nextReminderAt).toBeNull();

    await reconcile();
    await runSchedulerAt(new Date(T0.getTime() + MINUTE));
    expect(await remindersQueued(raw.id)).toBe(1);
  });

  it("a stale stored time never sends a reminder the item no longer needs", async () => {
    const userId = await seedUser();
    const itemId = await seedItem(userId, await seedBucket(userId), { deadline: T0 });
    await db.update(items).set({ status: "completed" }).where(eq(items.id, itemId));

    await runSchedulerAt(new Date(T0.getTime() + MINUTE));
    expect(await remindersQueued(itemId)).toBe(0);
    const item = await db.query.items.findFirst({ where: eq(items.id, itemId) });
    expect(item?.nextReminderAt).toBeNull();
  });
});

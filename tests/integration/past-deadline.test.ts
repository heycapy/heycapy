import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, items, notificationQueue } from "@/lib/db/schema";
import { encryptValue } from "@/lib/crypto";
import { executeToolCall } from "@/lib/ai/capyTools";
import { addItemAction, updateItemAction } from "@/app/(app)/item-actions";
import { createItem, updateItemDeadline } from "@/app/api/telegram/telegram-utils";
import { POST as postWebhook } from "@/app/api/webhook/[bucketId]/route";
import {
  HOUR,
  resetSchedulerEnvironment,
  runSchedulerAt,
  seedBucket,
  seedItem,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

const session = vi.hoisted(() => ({ userId: 0 }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => session }));

const T0 = new Date("2026-03-10T12:00:00Z");
const PAST = new Date(T0.getTime() - 3 * HOUR);
const FUTURE = new Date(T0.getTime() + 3 * HOUR);
const KEY = "hc_live_pastdeadline";

beforeEach(() => useSchedulerEnvironment(T0));
afterEach(() => resetSchedulerEnvironment());

async function setup() {
  const userId = await seedUser();
  session.userId = userId;
  const bucketId = await seedBucket(
    userId,
    { medium: ["telegram"], repeat: "once" },
    { fields: [], notifyWhenOverdue: true }
  );
  await db
    .update(buckets)
    .set({ webhookKey: encryptValue(KEY) })
    .where(eq(buckets.id, bucketId));
  return { userId, bucketId };
}

async function latestItemId(bucketId: number): Promise<number> {
  const [row] = await db
    .select({ id: items.id })
    .from(items)
    .where(eq(items.bucketId, bucketId))
    .orderBy(desc(items.id))
    .limit(1);
  return row.id;
}

async function sentKinds(itemId: number): Promise<string[]> {
  await runSchedulerAt(new Date(T0.getTime() + 60_000));
  const rows = await db
    .select({ kind: notificationQueue.kind })
    .from(notificationQueue)
    .where(and(eq(notificationQueue.itemId, itemId), ne(notificationQueue.status, "skipped")));
  return rows.map((r) => r.kind ?? "").sort();
}

describe("a deadline that is already past sends only the overdue alert", () => {
  it("web: adding an item", async () => {
    const { bucketId } = await setup();
    await addItemAction(bucketId, "netflix sub", PAST.toISOString());
    expect(await sentKinds(await latestItemId(bucketId))).toEqual(["overdue"]);
  });

  it("web: moving an item's date into the past", async () => {
    const { userId, bucketId } = await setup();
    const itemId = await seedItem(userId, bucketId, { deadline: FUTURE });
    await updateItemAction(itemId, "netflix sub", PAST.toISOString());
    expect(await sentKinds(itemId)).toEqual(["overdue"]);
  });

  it("assistant: adding and rescheduling", async () => {
    const { userId, bucketId } = await setup();
    await executeToolCall(
      {
        id: "a",
        name: "add_item",
        arguments: { bucket_id: bucketId, title: "x", deadline: PAST.toISOString() },
      },
      userId
    );
    expect(await sentKinds(await latestItemId(bucketId))).toEqual(["overdue"]);

    const itemId = await seedItem(userId, bucketId, { deadline: FUTURE });
    await executeToolCall(
      {
        id: "b",
        name: "update_item",
        arguments: { item_id: itemId, deadline: PAST.toISOString() },
      },
      userId
    );
    expect(await sentKinds(itemId)).toEqual(["overdue"]);
  });

  it("telegram: adding and rescheduling", async () => {
    const { userId, bucketId } = await setup();
    await createItem(userId, bucketId, "x", PAST);
    expect(await sentKinds(await latestItemId(bucketId))).toEqual(["overdue"]);

    const itemId = await seedItem(userId, bucketId, { deadline: FUTURE });
    await updateItemDeadline(userId, itemId, PAST);
    expect(await sentKinds(itemId)).toEqual(["overdue"]);
  });

  it("webhook: an item arriving with a past deadline", async () => {
    const { bucketId } = await setup();
    const res = await postWebhook(
      new Request(`http://localhost/api/webhook/${bucketId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ title: "x", deadline: PAST.toISOString() }),
      }),
      { params: Promise.resolve({ bucketId: String(bucketId) }) }
    );
    expect(res.status).toBe(201);
    expect(await sentKinds(await latestItemId(bucketId))).toEqual(["overdue"]);
  });
});

describe("future deadlines are unchanged", () => {
  it("a reminder whose early warning already started still goes out now", async () => {
    const { userId, bucketId } = await setup();
    const itemId = await seedItem(userId, bucketId, { deadline: FUTURE });
    await db
      .update(items)
      .set({ notificationOffsetMins: 24 * 60 })
      .where(eq(items.id, itemId));
    await updateItemAction(itemId, "x", new Date(T0.getTime() + 2 * HOUR).toISOString());
    expect(await sentKinds(itemId)).toEqual(["reminder"]);
  });
});

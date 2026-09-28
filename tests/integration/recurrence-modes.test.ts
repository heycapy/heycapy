import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, items } from "@/lib/db/schema";
import { ITEM_STATUS } from "@/constants";
import type { RecurrenceMode } from "@/types/rules";
import { completeItem } from "@/lib/reminders/quick-actions";
import {
  resetSchedulerEnvironment,
  runSchedulerAt,
  seedBucket,
  seedItem,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";
import { callsTo, connectOwnChat, say, stubTelegram } from "./telegram-helpers";

const MAR_10_9AM = new Date("2026-03-10T09:00:00Z");
const DAILY = JSON.stringify({ enabled: true, frequency: "daily", interval: 1, endDate: null });
const EVERY_3_DAYS = JSON.stringify({
  enabled: true,
  frequency: "daily",
  interval: 3,
  endDate: null,
});

beforeEach(() => useSchedulerEnvironment(new Date("2026-03-10T10:00:00Z")));
afterEach(() => resetSchedulerEnvironment());

async function setup(mode: RecurrenceMode, recurring = DAILY) {
  const userId = await seedUser();
  const bucketId = await seedBucket(userId);
  await db
    .update(buckets)
    .set({ itemsRules: JSON.stringify({ recurrenceMode: mode }) })
    .where(eq(buckets.id, bucketId));
  const itemId = await seedItem(userId, bucketId, { deadline: MAR_10_9AM, title: "gym" });
  await db.update(items).set({ recurring }).where(eq(items.id, itemId));
  return { userId, bucketId, itemId };
}

async function series(bucketId: number) {
  return db
    .select({
      id: items.id,
      status: items.status,
      deadline: items.deadline,
      recurring: items.recurring,
    })
    .from(items)
    .where(and(eq(items.bucketId, bucketId)))
    .orderBy(asc(items.id));
}

describe("move on if missed", () => {
  it("marks an unfinished occurrence missed once the next one arrives", async () => {
    const { bucketId } = await setup("moveOn");

    await runSchedulerAt(new Date("2026-03-11T08:59:00Z"));
    expect(await series(bucketId)).toHaveLength(1);

    await runSchedulerAt(new Date("2026-03-11T09:00:00Z"));
    const [missed, current] = await series(bucketId);
    expect(missed).toMatchObject({ status: ITEM_STATUS.missed, recurring: null });
    expect(current).toMatchObject({
      status: "active",
      deadline: new Date("2026-03-11T09:00:00Z"),
    });
    expect(current.recurring).not.toBeNull();
  });

  it("after days offline, jumps to today's occurrence with a single missed one", async () => {
    const { bucketId } = await setup("moveOn");

    await runSchedulerAt(new Date("2026-03-14T10:00:00Z"));

    const rows = await series(bucketId);
    expect(rows.map((r) => r.status)).toEqual([ITEM_STATUS.missed, "active"]);
    expect(rows[1].deadline).toEqual(new Date("2026-03-14T09:00:00Z"));
  });

  it("leaves items on hold alone", async () => {
    const { bucketId, itemId } = await setup("moveOn");
    await db.update(items).set({ status: ITEM_STATUS.onHold }).where(eq(items.id, itemId));

    await runSchedulerAt(new Date("2026-03-12T10:00:00Z"));

    expect(await series(bucketId)).toHaveLength(1);
  });

  it("missed occurrences stop reminding and never show in Telegram lists", async () => {
    const api = stubTelegram();
    const { userId, bucketId } = await setup("moveOn");
    const chat = await connectOwnChat(userId);
    await runSchedulerAt(new Date("2026-03-11T09:00:00Z"));
    const [missed] = await series(bucketId);
    const row = await db.query.items.findFirst({ where: eq(items.id, missed.id) });
    expect(row?.nextReminderAt).toBeNull();
    expect(row?.nextOverdueAt).toBeNull();

    await say("⚠️ Overdue", chat);
    await say("📋 Today", chat);

    const texts = callsTo(api, "sendMessage").map((m) => String(m.text));
    expect(texts.filter((t) => t.includes("1. gym"))).toHaveLength(1);
    expect(texts.join("\n")).not.toContain("2. gym");
  });
});

describe("wait for me", () => {
  it("keeps the unfinished occurrence open and makes no new one", async () => {
    const { bucketId } = await setup("wait");

    await runSchedulerAt(new Date("2026-03-12T10:00:00Z"));

    expect((await series(bucketId)).map((r) => r.status)).toEqual(["active"]);
  });
});

describe("after completion", () => {
  it("counts the next date from the day it was completed", async () => {
    const { userId, bucketId, itemId } = await setup("afterCompletion", EVERY_3_DAYS);
    vi.setSystemTime(new Date("2026-03-12T18:00:00Z"));

    await completeItem(userId, itemId, "app");

    const [, next] = await series(bucketId);
    expect(next.deadline).toEqual(new Date("2026-03-15T09:00:00Z"));
  });

  it("the usual mode counts from the schedule instead", async () => {
    const { userId, bucketId, itemId } = await setup("wait", EVERY_3_DAYS);
    vi.setSystemTime(new Date("2026-03-12T18:00:00Z"));

    await completeItem(userId, itemId, "app");

    const [, next] = await series(bucketId);
    expect(next.deadline).toEqual(new Date("2026-03-13T09:00:00Z"));
  });
});

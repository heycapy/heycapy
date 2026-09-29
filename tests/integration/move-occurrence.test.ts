import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as SessionModule from "@/lib/auth/session";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, items } from "@/lib/db/schema";
import { ITEM_STATUS } from "@/constants";
import type { RecurrenceMode } from "@/types/rules";
import { completeItem } from "@/lib/reminders/quick-actions";
import { moveOccurrence, skipOccurrence } from "@/lib/items/recurrence";
import { updateItemAction } from "@/app/(app)/item-actions";
import { executeToolCall } from "@/lib/ai/capyTools";
import {
  resetSchedulerEnvironment,
  runSchedulerAt,
  seedBucket,
  seedItem,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";
import { callsTo, connectOwnChat, stubTelegram, tap } from "./telegram-helpers";

const session = vi.hoisted(() => ({ userId: 0, email: "" }));
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof SessionModule>()),
  getSession: async () => session,
}));

const NOW = new Date("2026-03-10T12:00:00Z");
const MON_MAR_9 = new Date("2026-03-09T09:00:00Z");
const WED_MAR_11 = new Date("2026-03-11T09:00:00Z");
const MON_MAR_16 = new Date("2026-03-16T09:00:00Z");
const WED_MAR_18 = new Date("2026-03-18T09:00:00Z");
const MON_MAR_23 = new Date("2026-03-23T09:00:00Z");
const WEEKLY = JSON.stringify({ enabled: true, frequency: "weekly", interval: 1, endDate: null });

beforeEach(() => useSchedulerEnvironment(NOW));
afterEach(() => resetSchedulerEnvironment());

async function setup(
  opts: { mode?: RecurrenceMode; recurring?: string | null; deadline?: Date } = {}
) {
  const userId = await seedUser();
  session.userId = userId;
  const bucketId = await seedBucket(userId);
  if (opts.mode) {
    await db
      .update(buckets)
      .set({ itemsRules: JSON.stringify({ recurrenceMode: opts.mode }) })
      .where(eq(buckets.id, bucketId));
  }
  const itemId = await seedItem(userId, bucketId, {
    deadline: opts.deadline ?? MON_MAR_9,
    title: "gym",
  });
  const recurring = opts.recurring === undefined ? WEEKLY : opts.recurring;
  await db.update(items).set({ recurring }).where(eq(items.id, itemId));
  return { userId, bucketId, itemId };
}

async function itemOf(itemId: number) {
  const item = await db.query.items.findFirst({ where: eq(items.id, itemId) });
  if (!item) throw new Error(`item ${itemId} not found`);
  return item;
}

async function series(bucketId: number) {
  return db
    .select({ status: items.status, deadline: items.deadline, scheduledAt: items.scheduledAt })
    .from(items)
    .where(eq(items.bucketId, bucketId))
    .orderBy(asc(items.id));
}

describe("moving one occurrence of a repeating item", () => {
  it("keeps the next one on its usual day", async () => {
    const { userId, bucketId, itemId } = await setup();

    const moved = await moveOccurrence(userId, itemId, WED_MAR_11);
    expect(moved).toEqual({ ok: true, next: MON_MAR_16 });
    expect(await itemOf(itemId)).toMatchObject({ deadline: WED_MAR_11, scheduledAt: MON_MAR_9 });

    await completeItem(userId, itemId, "app");
    expect(await series(bucketId)).toEqual([
      { status: ITEM_STATUS.completed, deadline: WED_MAR_11, scheduledAt: MON_MAR_9 },
      { status: "active", deadline: MON_MAR_16, scheduledAt: null },
    ]);
  });

  it("moved past the next one, the series carries on after the moved date", async () => {
    const { userId, bucketId, itemId } = await setup();

    const moved = await moveOccurrence(userId, itemId, WED_MAR_18);
    expect(moved).toEqual({ ok: true, next: MON_MAR_23 });

    await completeItem(userId, itemId, "app");
    expect((await series(bucketId))[1]).toMatchObject({ deadline: MON_MAR_23 });
  });

  it("remembers the first scheduled date across several moves, and forgets it when moved back", async () => {
    const { userId, itemId } = await setup();

    await moveOccurrence(userId, itemId, WED_MAR_11);
    await moveOccurrence(userId, itemId, new Date("2026-03-12T09:00:00Z"));
    expect(await itemOf(itemId)).toMatchObject({ scheduledAt: MON_MAR_9 });

    await moveOccurrence(userId, itemId, MON_MAR_9);
    expect(await itemOf(itemId)).toMatchObject({ deadline: MON_MAR_9, scheduledAt: null });
  });

  it("a one-off item just moves", async () => {
    const { userId, itemId } = await setup({ recurring: null });

    expect(await moveOccurrence(userId, itemId, WED_MAR_11)).toEqual({ ok: true, next: null });
    expect(await itemOf(itemId)).toMatchObject({ deadline: WED_MAR_11, scheduledAt: null });
  });

  it("can't move another user's item or one in the trash", async () => {
    const { userId, itemId } = await setup();
    const stranger = await seedUser();

    expect(await moveOccurrence(stranger, itemId, WED_MAR_11)).toMatchObject({ ok: false });
    await db.update(items).set({ deletedAt: NOW }).where(eq(items.id, itemId));
    expect(await moveOccurrence(userId, itemId, WED_MAR_11)).toMatchObject({ ok: false });
    expect(await itemOf(itemId)).toMatchObject({ deadline: MON_MAR_9 });
  });

  it("after completion mode: the next date isn't known ahead", async () => {
    const { userId, itemId } = await setup({ mode: "afterCompletion" });
    expect(await moveOccurrence(userId, itemId, WED_MAR_11)).toEqual({ ok: true, next: null });
  });

  it("skipping a moved occurrence goes to the next one on the schedule", async () => {
    const { userId, itemId } = await setup();
    await moveOccurrence(userId, itemId, WED_MAR_11);

    expect(await skipOccurrence(userId, itemId)).toEqual({ ok: true });
    expect(await itemOf(itemId)).toMatchObject({ deadline: MON_MAR_16, scheduledAt: null });
  });
});

describe("move on if missed", () => {
  it("a moved occurrence is missed only once the next one after its new date arrives", async () => {
    const { userId, bucketId, itemId } = await setup({ mode: "moveOn" });
    await moveOccurrence(userId, itemId, WED_MAR_18);

    await runSchedulerAt(new Date("2026-03-18T10:00:00Z"));
    expect(await series(bucketId)).toHaveLength(1);

    await runSchedulerAt(MON_MAR_23);
    expect(await series(bucketId)).toEqual([
      { status: ITEM_STATUS.missed, deadline: WED_MAR_18, scheduledAt: MON_MAR_9 },
      { status: "active", deadline: MON_MAR_23, scheduledAt: null },
    ]);
  });

  it("moved earlier, the next one still comes on its usual day", async () => {
    const { userId, bucketId, itemId } = await setup({
      mode: "moveOn",
      deadline: MON_MAR_16,
    });
    await moveOccurrence(userId, itemId, new Date("2026-03-15T09:00:00Z"));

    await runSchedulerAt(new Date("2026-03-16T08:59:00Z"));
    expect(await series(bucketId)).toHaveLength(1);

    await runSchedulerAt(new Date("2026-03-23T09:00:00Z"));
    expect((await series(bucketId))[1]).toMatchObject({ deadline: MON_MAR_23 });
  });
});

describe("the edit form moves the whole schedule", () => {
  it("saving other changes keeps the moved date and the series", async () => {
    const { userId, bucketId, itemId } = await setup();
    await moveOccurrence(userId, itemId, WED_MAR_11);

    const result = await updateItemAction(itemId, "leg day", WED_MAR_11.toISOString());
    expect(result).toEqual({ ok: true });
    expect(await itemOf(itemId)).toMatchObject({
      title: "leg day",
      deadline: WED_MAR_11,
      scheduledAt: MON_MAR_9,
    });

    await completeItem(userId, itemId, "app");
    expect((await series(bucketId))[1]).toMatchObject({ deadline: MON_MAR_16 });
  });

  it("a new date there becomes the new schedule", async () => {
    const { userId, bucketId, itemId } = await setup();
    await moveOccurrence(userId, itemId, WED_MAR_11);

    const thursday = new Date("2026-03-12T09:00:00Z");
    await updateItemAction(itemId, "gym", thursday.toISOString());
    expect(await itemOf(itemId)).toMatchObject({ deadline: thursday, scheduledAt: null });

    await completeItem(userId, itemId, "app");
    expect((await series(bucketId))[1]).toMatchObject({
      deadline: new Date("2026-03-19T09:00:00Z"),
    });
  });

  it("turning the repeat off forgets the scheduled date", async () => {
    const { userId, itemId } = await setup();
    await moveOccurrence(userId, itemId, WED_MAR_11);

    await updateItemAction(itemId, "gym", WED_MAR_11.toISOString(), undefined, null);
    expect(await itemOf(itemId)).toMatchObject({ recurring: null, scheduledAt: null });
  });

  it("a moved last-day-of-month occurrence isn't pulled back to the month's end", async () => {
    const lastDay = JSON.stringify({
      enabled: true,
      frequency: "monthly",
      interval: 1,
      endDate: null,
      anchorDay: 31,
    });
    const mar31 = new Date("2026-03-31T09:00:00Z");
    const apr2 = new Date("2026-04-02T09:00:00Z");
    const { userId, bucketId, itemId } = await setup({ recurring: lastDay, deadline: mar31 });
    await moveOccurrence(userId, itemId, apr2);

    await updateItemAction(itemId, "rent", apr2.toISOString());
    expect(await itemOf(itemId)).toMatchObject({ deadline: apr2, scheduledAt: mar31 });

    await completeItem(userId, itemId, "app");
    expect((await series(bucketId))[1]).toMatchObject({
      deadline: new Date("2026-04-30T09:00:00Z"),
    });
  });

  it("the assistant changing the date moves the schedule too", async () => {
    const { userId, itemId } = await setup();
    await moveOccurrence(userId, itemId, WED_MAR_11);

    await executeToolCall(
      {
        id: "c",
        name: "update_item",
        arguments: { item_id: itemId, deadline: "2026-03-12T09:00" },
      },
      userId
    );
    expect(await itemOf(itemId)).toMatchObject({ scheduledAt: null });
  });

  it("the assistant renaming it keeps the moved date", async () => {
    const { userId, itemId } = await setup();
    await moveOccurrence(userId, itemId, WED_MAR_11);

    await executeToolCall(
      { id: "c", name: "update_item", arguments: { item_id: itemId, title: "leg day" } },
      userId
    );
    expect(await itemOf(itemId)).toMatchObject({ scheduledAt: MON_MAR_9 });
  });
});

describe("telegram reschedule", () => {
  it("moves only this time and says when the next one is", async () => {
    const api = stubTelegram();
    const { userId, itemId } = await setup();
    const chat = await connectOwnChat(userId);

    await tap(`rs:${itemId}`, chat);
    await tap("rd:tomorrow", chat);
    await tap("rt:09:00", chat);

    expect(await itemOf(itemId)).toMatchObject({ deadline: WED_MAR_11, scheduledAt: MON_MAR_9 });
    const edits = callsTo(api, "editMessageText");
    expect(edits[edits.length - 1]?.text).toBe(
      "📅 <b>gym</b>\nmoved to tomorrow, 9:00 AM\n↺ next one stays Mon, Mar 16, 9:00 AM"
    );
  });

  it("a one-off item gets no next-one line", async () => {
    const api = stubTelegram();
    const { userId, itemId } = await setup({ recurring: null });
    const chat = await connectOwnChat(userId);

    await tap(`rs:${itemId}`, chat);
    await tap("rd:tomorrow", chat);
    await tap("rt:09:00", chat);

    const edits = callsTo(api, "editMessageText");
    expect(edits[edits.length - 1]?.text).toBe("📅 <b>gym</b>\nmoved to tomorrow, 9:00 AM");
  });
});

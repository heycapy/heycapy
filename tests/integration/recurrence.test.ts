import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { executeToolCall } from "@/lib/ai/capyTools";
import { completeItemById } from "@/app/api/telegram/telegram-utils";
import {
  completeItemAction,
  skipOccurrenceAction,
  updateItemAction,
} from "@/app/(app)/item-actions";
import { refreshItemReminders } from "@/lib/reminders/refresh";
import {
  HOUR,
  MINUTE,
  resetSchedulerEnvironment,
  runSchedulerAt,
  seedBucket,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

const session = vi.hoisted(() => ({ userId: 0 }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => session }));

const T0 = new Date("2026-03-10T12:00:00Z");
const DAY = 24 * HOUR;
const MONTHLY = JSON.stringify({ enabled: true, frequency: "monthly", interval: 1, endDate: null });

beforeEach(() => useSchedulerEnvironment(T0));
afterEach(() => resetSchedulerEnvironment());

async function seedRecurring(opts: {
  deadline?: Date;
  medium?: string[];
  repeat?: "once" | "daily";
  recurring?: string;
  properties?: string;
}) {
  const userId = await seedUser();
  session.userId = userId;
  const bucketId = await seedBucket(userId, {
    medium: opts.medium ?? ["telegram"],
    repeat: opts.repeat ?? "once",
  });
  const [item] = await db
    .insert(items)
    .values({
      bucketId,
      userId,
      title: "pay rent",
      deadline: opts.deadline ?? new Date(T0.getTime() + 3 * DAY),
      recurring: opts.recurring ?? MONTHLY,
      properties: opts.properties ?? null,
      notificationOffsetMins: 60,
    })
    .returning();
  await refreshItemReminders([item.id]);
  return { userId, bucketId, itemId: item.id };
}

async function bucketItems(bucketId: number) {
  return db.select().from(items).where(eq(items.bucketId, bucketId)).orderBy(asc(items.id));
}

describe("completing a recurring item creates the next occurrence", () => {
  it("from the web UI, before its reminder was ever sent", async () => {
    const { bucketId, itemId } = await seedRecurring({});
    await completeItemAction(itemId);

    const [done, next] = await bucketItems(bucketId);
    expect(done.status).toBe("completed");
    expect(next?.status).toBe("active");
    expect(next?.deadline?.toISOString()).toBe("2026-04-13T12:00:00.000Z");
  });

  it("from the web UI edit dialog", async () => {
    const { bucketId, itemId } = await seedRecurring({});
    await updateItemAction(itemId, "pay rent", "2026-03-13T12:00:00.000Z", "completed");
    expect(await bucketItems(bucketId)).toHaveLength(2);
  });

  it("from the assistant", async () => {
    const { userId, bucketId, itemId } = await seedRecurring({});
    await executeToolCall(
      { id: "c", name: "complete_item", arguments: { item_id: itemId } },
      userId
    );
    expect(await bucketItems(bucketId)).toHaveLength(2);
  });

  it("from telegram's Done button", async () => {
    const { userId, bucketId, itemId } = await seedRecurring({});
    await completeItemById(userId, itemId);
    expect(await bucketItems(bucketId)).toHaveLength(2);
  });

  it("even when the bucket has no notification channels", async () => {
    const { bucketId, itemId } = await seedRecurring({ medium: [] });
    await completeItemAction(itemId);
    expect(await bucketItems(bucketId)).toHaveLength(2);
  });
});

describe("the next occurrence", () => {
  it("carries over the item's settings and fields", async () => {
    const { bucketId, itemId } = await seedRecurring({
      properties: JSON.stringify({ amount: 1200 }),
    });
    await completeItemAction(itemId);

    const [, next] = await bucketItems(bucketId);
    expect(next.title).toBe("pay rent");
    expect(next.notificationOffsetMins).toBe(60);
    expect(next.recurring).toBe(MONTHLY);
    expect(next.properties).toBe(JSON.stringify({ amount: 1200 }));
  });

  it("skips past dates when an overdue item is completed late", async () => {
    const { bucketId, itemId } = await seedRecurring({
      deadline: new Date(T0.getTime() - 70 * DAY),
    });
    await completeItemAction(itemId);

    const [, next] = await bucketItems(bucketId);
    expect(next.deadline && next.deadline > T0).toBe(true);
  });

  it("is not created past the recurrence end date", async () => {
    const recurring = JSON.stringify({
      enabled: true,
      frequency: "monthly",
      interval: 1,
      endDate: "2026-03-31",
    });
    const { bucketId, itemId } = await seedRecurring({ recurring });
    await completeItemAction(itemId);
    expect(await bucketItems(bucketId)).toHaveLength(1);
  });

  it("gets its own reminder", async () => {
    const { bucketId, itemId } = await seedRecurring({});
    await completeItemAction(itemId);

    const [, next] = await bucketItems(bucketId);
    expect(next.nextReminderAt?.toISOString()).toBe("2026-04-13T11:00:00.000Z");
  });
});

describe("no duplicate occurrences", () => {
  it("reminders alone never create occurrences, even with daily repeat", async () => {
    const { bucketId } = await seedRecurring({ deadline: T0, repeat: "daily" });
    for (let day = 0; day < 4; day++) {
      await runSchedulerAt(new Date(T0.getTime() + day * DAY + MINUTE));
    }
    expect(await bucketItems(bucketId)).toHaveLength(1);
  });

  it("un-completing and completing again does not create a second copy", async () => {
    const { bucketId, itemId } = await seedRecurring({});
    await completeItemAction(itemId);
    await completeItemAction(itemId);
    await completeItemAction(itemId);
    expect(await bucketItems(bucketId)).toHaveLength(2);
  });
});

describe("skipping one occurrence", () => {
  it("moves the item to its next date without creating a copy", async () => {
    const { bucketId, itemId } = await seedRecurring({});
    expect(await skipOccurrenceAction(itemId)).toEqual({ ok: true });

    const all = await bucketItems(bucketId);
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe("active");
    expect(all[0].deadline?.toISOString()).toBe("2026-04-13T12:00:00.000Z");
    expect(all[0].recurring).toBe(MONTHLY);
  });

  it("re-arms the reminder for the new date", async () => {
    const { itemId } = await seedRecurring({ deadline: T0 });
    await runSchedulerAt(new Date(T0.getTime() + MINUTE));
    await skipOccurrenceAction(itemId);

    const item = await db.query.items.findFirst({ where: eq(items.id, itemId) });
    expect(item?.nextReminderAt?.toISOString()).toBe("2026-04-10T11:00:00.000Z");
  });

  it("jumps an overdue item to the next future date", async () => {
    const { itemId } = await seedRecurring({ deadline: new Date(T0.getTime() - 70 * DAY) });
    await skipOccurrenceAction(itemId);

    const item = await db.query.items.findFirst({ where: eq(items.id, itemId) });
    expect(item?.deadline && item.deadline > T0).toBe(true);
  });

  it("refuses to skip the last occurrence", async () => {
    const recurring = JSON.stringify({
      enabled: true,
      frequency: "monthly",
      interval: 1,
      endDate: "2026-03-31",
    });
    const { itemId } = await seedRecurring({ recurring });
    expect(await skipOccurrenceAction(itemId)).toEqual({
      ok: false,
      error: "This is the last occurrence — complete or delete it instead",
    });
  });

  it("refuses items that are completed or not repeating", async () => {
    const { itemId } = await seedRecurring({});
    await completeItemAction(itemId);
    expect((await skipOccurrenceAction(itemId)).ok).toBe(false);

    const plain = await seedRecurring({ recurring: "" });
    expect((await skipOccurrenceAction(plain.itemId)).ok).toBe(false);
  });

  it("cannot skip another user's item", async () => {
    const { itemId } = await seedRecurring({});
    await seedRecurring({});
    expect(await skipOccurrenceAction(itemId)).toEqual({ ok: false, error: "Item not found" });
  });
});

describe("stopping a repeat", () => {
  it("turning repeat off in the edit dialog means completing creates no next occurrence", async () => {
    const { bucketId, itemId } = await seedRecurring({});
    await updateItemAction(itemId, "pay rent", "2026-03-13T12:00:00.000Z", "active", null);
    await completeItemAction(itemId);
    expect(await bucketItems(bucketId)).toHaveLength(1);
  });
});

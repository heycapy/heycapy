import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, items } from "@/lib/db/schema";
import { encryptValue } from "@/lib/crypto";
import { addItemAction, updateItemAction } from "@/app/(app)/item-actions";
import {
  completeItemById,
  createItem,
  parseNaturalDeadline,
} from "@/app/api/telegram/telegram-utils";
import { POST as postWebhook } from "@/app/api/webhook/[bucketId]/route";
import {
  resetSchedulerEnvironment,
  seedBucket,
  seedItem,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

const session = vi.hoisted(() => ({ userId: 0 }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => session }));

// 17:30 on Mar 10 in Kolkata
const T0 = new Date("2026-03-10T12:00:00Z");
const TZ = "Asia/Kolkata";
const MAR_10_ALL_DAY = new Date("2026-03-09T18:30:00Z");
const MAR_11_ALL_DAY = new Date("2026-03-10T18:30:00Z");
const KEY = "hc_live_allday";

beforeEach(() => useSchedulerEnvironment(T0));
afterEach(() => resetSchedulerEnvironment());

async function setup(timezone = TZ) {
  const userId = await seedUser(timezone);
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

async function latest(bucketId: number) {
  const [row] = await db
    .select()
    .from(items)
    .where(eq(items.bucketId, bucketId))
    .orderBy(desc(items.id))
    .limit(1);
  return row;
}

describe("a date without a time is all day, in the user's timezone, everywhere", () => {
  it("web", async () => {
    const { bucketId } = await setup();
    await addItemAction(bucketId, "pay rent", "2026-03-11");
    expect((await latest(bucketId)).deadline).toEqual(MAR_11_ALL_DAY);
  });

  it("webhook", async () => {
    const { bucketId } = await setup();
    const res = await postWebhook(
      new Request(`http://localhost/api/webhook/${bucketId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ title: "pay rent", deadline: "2026-03-11" }),
      }),
      { params: Promise.resolve({ bucketId: String(bucketId) }) }
    );
    expect(res.status).toBe(201);
    expect((await latest(bucketId)).deadline).toEqual(MAR_11_ALL_DAY);
  });

  it("telegram", async () => {
    const { userId, bucketId } = await setup();
    await createItem(userId, bucketId, "pay rent", parseNaturalDeadline("tomorrow", TZ));
    expect((await latest(bucketId)).deadline).toEqual(MAR_11_ALL_DAY);
  });
});

describe("all-day reminders", () => {
  it("remind at 9:00 on the day and count as overdue only after the day ends", async () => {
    const { bucketId } = await setup();
    await addItemAction(bucketId, "pay rent", "2026-03-11");
    const item = await latest(bucketId);

    expect(item.nextReminderAt).toEqual(new Date("2026-03-11T03:30:00Z"));
    // Mar 12 00:00 in Kolkata, plus the default one-hour delay
    expect(item.nextOverdueAt).toEqual(new Date("2026-03-11T19:30:00Z"));
  });

  it("an all-day item for today isn't overdue while the day lasts", async () => {
    const { bucketId } = await setup();
    await addItemAction(bucketId, "pay rent", "2026-03-10");
    const item = await latest(bucketId);

    expect(item.deadline).toEqual(MAR_10_ALL_DAY);
    expect(item.notifiedAt).toBeNull();
    expect(item.nextOverdueAt).toEqual(new Date("2026-03-10T19:30:00Z"));
  });
});

describe("editing on the web", () => {
  it("renaming an all-day item leaves its date and reminder alone", async () => {
    const { userId, bucketId } = await setup();
    const itemId = await seedItem(userId, bucketId, {
      deadline: MAR_11_ALL_DAY,
      title: "pay rent",
    });
    const before = await db.query.items.findFirst({ where: eq(items.id, itemId) });

    // The editor sends an all-day date back as YYYY-MM-DD
    await updateItemAction(itemId, "pay the rent", "2026-03-11");

    const after = await db.query.items.findFirst({ where: eq(items.id, itemId) });
    expect(after?.deadline).toEqual(MAR_11_ALL_DAY);
    expect(after?.nextReminderAt).toEqual(before?.nextReminderAt);
  });
});

describe("a monthly series on the 31st", () => {
  it("lands on the last day of February, then on the 31st again", async () => {
    const { userId, bucketId } = await setup("UTC");
    vi.setSystemTime(new Date("2027-01-31T10:00:00Z"));
    const recurring = JSON.stringify({
      enabled: true,
      frequency: "monthly",
      interval: 1,
      endDate: null,
    });
    const first = await seedItem(userId, bucketId, { deadline: new Date("2027-01-31T09:00:00Z") });
    await db.update(items).set({ recurring }).where(eq(items.id, first));

    await completeItemById(userId, first);
    const feb = await latest(bucketId);
    expect(feb.deadline).toEqual(new Date("2027-02-28T09:00:00Z"));

    await completeItemById(userId, feb.id);
    expect((await latest(bucketId)).deadline).toEqual(new Date("2027-03-31T09:00:00Z"));
  });
});

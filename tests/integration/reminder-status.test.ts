import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, items, notificationQueue, userSettings } from "@/lib/db/schema";
import { enqueueNotification, processPending } from "@/lib/notifications/queue";
import {
  getItemReminderInfo,
  getReminderBadges,
  type HistoryEvent,
  type NotificationEvent,
} from "@/lib/reminders/status";
import { refreshItemReminders } from "@/lib/reminders/refresh";
import {
  HOUR,
  resetSchedulerEnvironment,
  runSchedulerAt,
  seedBucket,
  seedItem,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

function sentEvents(history: HistoryEvent[] | undefined): NotificationEvent[] {
  return (history ?? []).filter((e): e is NotificationEvent => e.type === "sent");
}

const T0 = new Date("2026-03-10T12:00:00Z");
const TOMORROW = new Date(T0.getTime() + 24 * HOUR);

beforeEach(() => useSchedulerEnvironment(T0));
afterEach(() => resetSchedulerEnvironment());

async function setup(medium: string[] = ["telegram"]) {
  const userId = await seedUser();
  const bucketId = await seedBucket(userId, { medium, repeat: "once" });
  const bucket = await db.query.buckets.findFirst({ where: eq(buckets.id, bucketId) });
  return { userId, bucketId, rules: bucket?.notificationsRules ?? "{}" };
}

async function badgesFor(userId: number, rules: string, bucketId: number) {
  const rows = await db.select().from(items).where(eq(items.bucketId, bucketId));
  return getReminderBadges(userId, rules, rows);
}

async function addJob(
  userId: number,
  itemId: number,
  fields: Partial<typeof notificationQueue.$inferInsert>
) {
  await db.insert(notificationQueue).values({
    userId,
    itemId,
    medium: "telegram",
    title: "t",
    message: "m",
    ...fields,
  });
}

describe("list badges", () => {
  it("upcoming when a reminder is scheduled", async () => {
    const { userId, bucketId, rules } = await setup();
    const itemId = await seedItem(userId, bucketId, { deadline: TOMORROW });
    expect(await badgesFor(userId, rules, bucketId)).toEqual({ [itemId]: "upcoming" });
  });

  it("noChannel when the bucket has no working channel", async () => {
    const { userId, bucketId, rules } = await setup([]);
    const itemId = await seedItem(userId, bucketId, { deadline: TOMORROW });
    expect(await badgesFor(userId, rules, bucketId)).toEqual({ [itemId]: "noChannel" });
  });

  it("failed when the latest delivery on a channel gave up", async () => {
    const { userId, bucketId, rules } = await setup();
    const itemId = await seedItem(userId, bucketId, { deadline: TOMORROW });
    await addJob(userId, itemId, { status: "dead", lastError: "chat not found" });
    expect(await badgesFor(userId, rules, bucketId)).toEqual({ [itemId]: "failed" });
  });

  it("an old failure clears once a later delivery succeeds", async () => {
    const { userId, bucketId, rules } = await setup();
    const itemId = await seedItem(userId, bucketId, { deadline: TOMORROW });
    await addJob(userId, itemId, { status: "dead" });
    await addJob(userId, itemId, { status: "sent", sentAt: T0 });
    expect(await badgesFor(userId, rules, bucketId)).toEqual({ [itemId]: "upcoming" });
  });

  it("history for completed or already-reminded items, nothing for undated ones", async () => {
    const { userId, bucketId, rules } = await setup();
    const done = await seedItem(userId, bucketId, { deadline: TOMORROW });
    await db.update(items).set({ status: "completed" }).where(eq(items.id, done));
    const reminded = await seedItem(userId, bucketId, { deadline: T0, notifiedAt: T0 });
    await db.insert(items).values({ bucketId, userId, title: "no date" });
    expect(await badgesFor(userId, rules, bucketId)).toEqual({
      [done]: "history",
      [reminded]: "history",
    });
  });
});

describe("dialog details", () => {
  it("shows when the next reminder is and where it goes", async () => {
    const { userId, bucketId } = await setup();
    const itemId = await seedItem(userId, bucketId, { deadline: TOMORROW });
    expect(await getItemReminderInfo(userId, itemId)).toEqual({
      next: TOMORROW,
      nextChannels: [
        { medium: "email", state: "notSelected" },
        { medium: "push", state: "notSelected" },
        { medium: "telegram", state: "send" },
        { medium: "ntfy", state: "notSelected" },
      ],
      completedAt: null,
      reason: null,
      remindAgain: null,
      history: [],
    });
  });

  it("explains why there is no reminder", async () => {
    const { userId, bucketId } = await setup();
    const reminded = await seedItem(userId, bucketId, { deadline: T0, notifiedAt: T0 });
    expect((await getItemReminderInfo(userId, reminded))?.reason).toBe("alreadyReminded");

    const completed = await seedItem(userId, bucketId, { deadline: TOMORROW });
    await db
      .update(items)
      .set({ status: "completed", completedAt: T0 })
      .where(eq(items.id, completed));
    const done = await getItemReminderInfo(userId, completed);
    expect(done?.reason).toBe("completed");
    expect(done?.completedAt).toEqual(T0);
    expect(done?.nextChannels).toBeNull();

    const onHold = await seedItem(userId, bucketId, { deadline: TOMORROW });
    await db.update(items).set({ status: "on hold" }).where(eq(items.id, onHold));
    await refreshItemReminders([onHold]);
    expect((await getItemReminderInfo(userId, onHold))?.reason).toBe("onHold");

    const other = await setup([]);
    const noChannel = await seedItem(other.userId, other.bucketId, { deadline: TOMORROW });
    expect((await getItemReminderInfo(other.userId, noChannel))?.reason).toBe("noChannel");
  });

  it("is not available for another user's item or an item without a date", async () => {
    const { userId, bucketId } = await setup();
    const itemId = await seedItem(userId, bucketId, { deadline: TOMORROW });
    const stranger = await seedUser();
    expect(await getItemReminderInfo(stranger, itemId)).toBeNull();

    const [undated] = await db.insert(items).values({ bucketId, userId, title: "x" }).returning();
    expect(await getItemReminderInfo(userId, undated.id)).toBeNull();
  });
});

describe("history records each channel as it was at send time", () => {
  it("a channel set up later still shows as not set up for older notifications", async () => {
    process.env.E2E_TEST_MODE = "1";
    process.env.RESEND_API_KEY = "test-key";
    const { userId, bucketId } = await setup(["email", "telegram"]);
    await db
      .update(userSettings)
      .set({ notificationsEmail: true, telegramChatId: null })
      .where(eq(userSettings.userId, userId));
    const itemId = await seedItem(userId, bucketId, { deadline: T0 });
    await db.update(items).set({ recurring: null }).where(eq(items.id, itemId));

    await runSchedulerAt(new Date(T0.getTime() + 60_000));
    await db
      .update(userSettings)
      .set({ telegramChatId: "42" })
      .where(eq(userSettings.userId, userId));
    await db
      .update(items)
      .set({ deadline: TOMORROW, notifiedAt: null })
      .where(eq(items.id, itemId));
    await refreshItemReminders([itemId]);

    const info = await getItemReminderInfo(userId, itemId);
    expect(info?.history).toHaveLength(1);
    const [sent] = sentEvents(info?.history);
    expect(sent?.kind).toBe("reminder");
    expect(sent?.channels.map((c) => [c.medium, c.outcome])).toEqual([
      ["email", "sent"],
      ["push", "notSelected"],
      ["telegram", "notSetUp"],
      ["ntfy", "notSelected"],
    ]);
    expect(info?.nextChannels?.filter((c) => c.state === "send").map((c) => c.medium)).toEqual([
      "email",
      "telegram",
    ]);
    delete process.env.E2E_TEST_MODE;
    delete process.env.RESEND_API_KEY;
  });

  it("groups a reminder and an overdue alert sent together into two notifications", async () => {
    const { userId, bucketId } = await setup();
    const itemId = await seedItem(userId, bucketId, { deadline: T0 });
    for (const kind of ["reminder", "overdue"] as const) {
      await enqueueNotification({
        userId,
        itemId,
        kind,
        title: "t",
        message: "m",
        channels: [
          { medium: "email", state: "notSelected" },
          { medium: "telegram", state: "send" },
          { medium: "ntfy", state: "notSetUp" },
        ],
      });
    }
    const history = sentEvents((await getItemReminderInfo(userId, itemId))?.history);
    expect(history.map((e) => e.kind)).toEqual(["overdue", "reminder"]);
    expect(history[0]?.channels.map((c) => c.outcome)).toEqual([
      "notSelected",
      "sending",
      "notSetUp",
    ]);
  });

  it("keeps older notifications without a kind apart when sent in the same second", async () => {
    const { userId, bucketId } = await setup();
    const itemId = await seedItem(userId, bucketId, { deadline: TOMORROW });
    for (let i = 0; i < 2; i++) {
      await addJob(userId, itemId, { medium: "email", createdAt: T0, status: "sent", sentAt: T0 });
    }
    const history = sentEvents((await getItemReminderInfo(userId, itemId))?.history);
    expect(history.map((e) => e.channels.map((c) => c.medium))).toEqual([["email"], ["email"]]);
  });

  it("shows retrying and failed deliveries with their errors", async () => {
    const { userId, bucketId } = await setup();
    const itemId = await seedItem(userId, bucketId, { deadline: TOMORROW });
    const retryAt = new Date(T0.getTime() + 5 * 60_000);
    await addJob(userId, itemId, {
      kind: "reminder",
      createdAt: T0,
      medium: "email",
      status: "dead",
      lastError: "SMTP auth failed",
    });
    await addJob(userId, itemId, {
      kind: "reminder",
      createdAt: T0,
      status: "pending",
      attempts: 1,
      nextRetryAt: retryAt,
      lastError: "timeout",
    });

    const [event] = sentEvents((await getItemReminderInfo(userId, itemId))?.history);
    expect(event?.channels).toEqual([
      { medium: "email", outcome: "failed", error: "SMTP auth failed", retryAt: null },
      { medium: "telegram", outcome: "retrying", error: "timeout", retryAt },
    ]);
  });

  it("keeps the 10 most recent notifications", async () => {
    const { userId, bucketId } = await setup();
    const itemId = await seedItem(userId, bucketId, { deadline: TOMORROW });
    for (let i = 0; i < 12; i++) {
      vi.setSystemTime(new Date(T0.getTime() + i * HOUR));
      await enqueueNotification({
        userId,
        itemId,
        kind: "reminder",
        title: "t",
        message: "m",
        channels: [{ medium: "telegram", state: "send" }],
      });
    }
    expect((await getItemReminderInfo(userId, itemId))?.history).toHaveLength(10);
  });
});

describe("a reminder for an item closed before it was sent", () => {
  it("is recorded as not sent, not as sent", async () => {
    const { userId, bucketId } = await setup();
    const itemId = await seedItem(userId, bucketId, { deadline: TOMORROW });
    await enqueueNotification({
      userId,
      itemId,
      kind: "reminder",
      title: "t",
      message: "m",
      channels: [{ medium: "telegram", state: "send" }],
    });
    await db.update(items).set({ status: "completed" }).where(eq(items.id, itemId));
    await processPending();

    const [event] = sentEvents((await getItemReminderInfo(userId, itemId))?.history);
    expect(event?.channels.map((c) => c.outcome)).toEqual(["closed"]);
  });
});

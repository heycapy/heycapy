import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { items, userSettings } from "@/lib/db/schema";
import { callsTo, connectOwnChat, stubTelegram, tap } from "./telegram-helpers";
import {
  HOUR,
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

function sentTelegramTexts(): string[] {
  return vi
    .mocked(fetch)
    .mock.calls.filter(([url]) => String(url).endsWith("/sendMessage"))
    .map(([, init]) => (JSON.parse(String(init?.body)) as { text: string }).text);
}

it("a telegram reminder names the item", async () => {
  const userId = await seedUser();
  const bucketId = await seedBucket(userId);
  await seedItem(userId, bucketId, { deadline: T0, title: "renew passport" });

  await runSchedulerAt(T0);

  expect(sentTelegramTexts()).toEqual([expect.stringContaining("renew passport")]);
});

it("a telegram reminder names the item when AI-written messages are off", async () => {
  const userId = await seedUser();
  await db
    .update(userSettings)
    .set({ aiNotifyMessages: false })
    .where(eq(userSettings.userId, userId));
  const bucketId = await seedBucket(userId);
  await seedItem(userId, bucketId, { deadline: T0, title: "renew passport" });

  await runSchedulerAt(T0);

  expect(sentTelegramTexts()).toEqual([expect.stringContaining("renew passport")]);
});

it("a telegram overdue alert names the item", async () => {
  const userId = await seedUser();
  const bucketId = await seedBucket(
    userId,
    { medium: ["telegram"], repeat: "once" },
    { fields: [], notifyWhenOverdue: true }
  );
  await seedItem(userId, bucketId, {
    deadline: new Date(T0.getTime() - 2 * HOUR),
    notifiedAt: new Date(T0.getTime() - 2 * HOUR),
    title: "renew passport",
  });

  await runSchedulerAt(T0);

  expect(sentTelegramTexts()).toEqual([expect.stringContaining("renew passport")]);
});

it("a reminder shows the full title in bold with the due date and bucket", async () => {
  const api = stubTelegram();
  const userId = await seedUser();
  await db
    .update(userSettings)
    .set({ aiNotifyMessages: false })
    .where(eq(userSettings.userId, userId));
  const bucketId = await seedBucket(userId);
  const title = "Renew the passport before the trip & book the appointment <urgent>";
  await seedItem(userId, bucketId, { deadline: T0, title });

  await runSchedulerAt(T0);

  const [sent] = callsTo(api, "sendMessage");
  expect(sent.parse_mode).toBe("HTML");
  expect(sent.text).toMatch(
    /^⏰ <b>Renew the passport before the trip &amp; book the appointment &lt;urgent&gt;<\/b>\ndue today, 12:00 PM · Bucket /
  );
});

it("a new overdue alert replaces the previous one for the same item", async () => {
  const api = stubTelegram();
  const userId = await seedUser();
  const bucketId = await seedBucket(
    userId,
    { medium: ["telegram"], repeat: "once" },
    { fields: [], notifyWhenOverdue: true, overdueRepeatHours: 1 }
  );
  await seedItem(userId, bucketId, {
    deadline: new Date(T0.getTime() - 2 * HOUR),
    notifiedAt: new Date(T0.getTime() - 2 * HOUR),
  });

  await runSchedulerAt(T0);
  expect(callsTo(api, "deleteMessage")).toEqual([]);

  await runSchedulerAt(new Date(T0.getTime() + HOUR));
  expect(callsTo(api, "sendMessage")).toHaveLength(2);
  expect(callsTo(api, "deleteMessage")).toEqual([{ chat_id: "42", message_id: 100 }]);
});

describe("tapping Done on a reminder", () => {
  const tapDone = (itemId: number, chat: number) => tap(`qc:${itemId}`, chat);

  it("completes the item and updates the reminder in place", async () => {
    const api = stubTelegram();
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);
    const itemId = await seedItem(userId, bucketId, { deadline: T0, title: "pay rent" });
    const chat = await connectOwnChat(userId);

    await tapDone(itemId, chat);

    const item = await db.query.items.findFirst({ where: eq(items.id, itemId) });
    expect(item?.status).toBe("completed");
    expect(callsTo(api, "sendMessage")).toEqual([]);
    expect(callsTo(api, "editMessageText")).toEqual([
      {
        chat_id: String(chat),
        message_id: 7,
        text: "✓ <s>pay rent</s>\ndone",
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [] },
      },
    ]);
  });

  it("says so when the item was already done or deleted", async () => {
    const api = stubTelegram();
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);
    const done = await seedItem(userId, bucketId, { deadline: T0, title: "pay rent" });
    await db.update(items).set({ status: "completed" }).where(eq(items.id, done));
    const deleted = await seedItem(userId, bucketId, { deadline: T0 });
    await db.update(items).set({ deletedAt: T0 }).where(eq(items.id, deleted));

    const chat = await connectOwnChat(userId);

    await tapDone(done, chat);
    await tapDone(deleted, chat);

    expect(callsTo(api, "editMessageText").map((c) => c.text)).toEqual([
      "✓ <s>pay rent</s>\nalready done",
      "this item no longer exists",
    ]);
    const stillDeleted = await db.query.items.findFirst({ where: eq(items.id, deleted) });
    expect(stillDeleted?.status).not.toBe("completed");
  });
});

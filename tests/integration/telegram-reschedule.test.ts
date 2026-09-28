import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { items, notificationQueue, userSettings } from "@/lib/db/schema";
import { getFlowState, setFlowState } from "@/app/api/telegram/telegram-utils";
import {
  HOUR,
  MINUTE,
  resetSchedulerEnvironment,
  runSchedulerAt,
  seedBucket,
  seedItem,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";
import {
  ALERT_MESSAGE_ID,
  callsTo,
  connectOwnChat,
  say,
  stubTelegram,
  tap,
  type TelegramApi,
} from "./telegram-helpers";

const T0 = new Date("2026-03-10T12:00:00Z");

beforeEach(() => useSchedulerEnvironment(T0));
afterEach(() => resetSchedulerEnvironment());

type Button = { text: string; callback_data: string };

function lastEdit(api: TelegramApi) {
  const edits = callsTo(api, "editMessageText");
  const edit = edits[edits.length - 1];
  return {
    text: String(edit?.text),
    messageId: edit?.message_id,
    keyboard: ((edit?.reply_markup as { inline_keyboard: Button[][] } | undefined)
      ?.inline_keyboard ?? []) as Button[][],
  };
}

const labels = (keyboard: Button[][]) => keyboard.map((row) => row.map((b) => b.text));

async function deadlineOf(itemId: number) {
  return (await db.query.items.findFirst({ where: eq(items.id, itemId) }))?.deadline;
}

// Delivered, not just queued: a queued-then-cancelled alert must not count
async function kindsSent(itemId: number) {
  const rows = await db
    .select({ kind: notificationQueue.kind })
    .from(notificationQueue)
    .where(and(eq(notificationQueue.itemId, itemId), eq(notificationQueue.status, "sent")));
  return rows.map((r) => r.kind);
}

async function setup(opts: { overdueAlerts?: boolean; defaultOffsetMins?: number } = {}) {
  const api = stubTelegram();
  const userId = await seedUser();
  const bucketId = await seedBucket(
    userId,
    { medium: ["telegram"], repeat: "once", defaultOffsetMins: opts.defaultOffsetMins ?? 0 },
    { fields: [], notifyWhenOverdue: opts.overdueAlerts ?? false, overdueRepeatHours: 1 }
  );
  const chat = await connectOwnChat(userId);
  return { api, userId, bucketId, chat };
}

describe("reminder buttons", () => {
  it("offer done, reschedule and quick remind-again times", async () => {
    const { api, userId, bucketId } = await setup();
    const itemId = await seedItem(userId, bucketId, { deadline: T0 });

    await runSchedulerAt(T0);

    const [sent] = callsTo(api, "sendMessage");
    expect(sent.reply_markup).toEqual({
      inline_keyboard: [
        [
          { text: "✓ Done", callback_data: `qc:${itemId}` },
          { text: "🕐 Reschedule", callback_data: `rs:${itemId}` },
        ],
        [
          { text: "15 min", callback_data: `rq:${itemId}:15` },
          { text: "30 min", callback_data: `rq:${itemId}:30` },
          { text: "1 hour", callback_data: `rq:${itemId}:60` },
          { text: "Tomorrow", callback_data: `rq:${itemId}:tomorrow` },
        ],
      ],
    });
  });
});

describe("remind me again", () => {
  it("pings again after 15 minutes without moving the deadline", async () => {
    const { api, userId, bucketId, chat } = await setup();
    const itemId = await seedItem(userId, bucketId, { deadline: T0, title: "pay rent" });
    await runSchedulerAt(T0);

    await tap(`rq:${itemId}:15`, chat);

    expect(lastEdit(api)).toMatchObject({
      text: "⏰ <b>pay rent</b>\nI'll remind you again today, 12:15 PM",
      keyboard: [],
    });
    expect(await deadlineOf(itemId)).toEqual(T0);
    await runSchedulerAt(new Date(T0.getTime() + 10 * MINUTE));
    expect(await kindsSent(itemId)).toEqual(["reminder"]);
    await runSchedulerAt(new Date(T0.getTime() + 16 * MINUTE));
    expect(await kindsSent(itemId)).toEqual(["reminder", "reminder"]);
  });

  it("tomorrow means the same time tomorrow", async () => {
    const { api, userId, bucketId, chat } = await setup();
    const itemId = await seedItem(userId, bucketId, { deadline: T0, title: "pay rent" });
    await runSchedulerAt(T0);

    await tap(`rq:${itemId}:tomorrow`, chat);

    expect(lastEdit(api).text).toBe("⏰ <b>pay rent</b>\nI'll remind you again tomorrow, 12:00 PM");
    await runSchedulerAt(new Date(T0.getTime() + 23 * HOUR));
    expect(await kindsSent(itemId)).toEqual(["reminder"]);
    await runSchedulerAt(new Date(T0.getTime() + 24 * HOUR + MINUTE));
    expect(await kindsSent(itemId)).toEqual(["reminder", "reminder"]);
  });

  it("on an overdue item sends exactly one alert at the chosen time", async () => {
    const { userId, bucketId, chat } = await setup({ overdueAlerts: true });
    const itemId = await seedItem(userId, bucketId, {
      deadline: new Date(T0.getTime() - 2 * HOUR),
      notifiedAt: new Date(T0.getTime() - 2 * HOUR),
    });
    await runSchedulerAt(T0);
    expect(await kindsSent(itemId)).toEqual(["overdue"]);

    await tap(`rq:${itemId}:60`, chat);

    await runSchedulerAt(new Date(T0.getTime() + 30 * MINUTE));
    expect(await kindsSent(itemId)).toEqual(["overdue"]);
    await runSchedulerAt(new Date(T0.getTime() + 61 * MINUTE));
    await runSchedulerAt(new Date(T0.getTime() + 62 * MINUTE));
    expect(await kindsSent(itemId)).toEqual(["overdue", "overdue"]);
  });
});

describe("reschedule", () => {
  it("walks when → what time → moved, all in the tapped reminder", async () => {
    const { api, userId, bucketId, chat } = await setup();
    const itemId = await seedItem(userId, bucketId, { deadline: T0, title: "pay rent" });

    await tap(`rs:${itemId}`, chat);
    const when = lastEdit(api);
    expect(when.messageId).toBe(ALERT_MESSAGE_ID);
    expect(when.text).toMatch(/\n\nWhen\?$/);
    expect(labels(when.keyboard)).toEqual([
      ["Today", "Tomorrow"],
      ["Next week"],
      ["📅 Pick a date"],
      ["🕐 Same day, new time"],
      ["✖ Cancel"],
    ]);

    await tap("rd:tomorrow", chat);
    const time = lastEdit(api);
    expect(time.text).toMatch(/\n\n→ tomorrow\nWhat time\?$/);
    expect(labels(time.keyboard)).toEqual([
      ["Keep 12pm"],
      ["9am", "12pm", "3pm"],
      ["6pm", "9pm"],
      ["⌨ Type a time"],
      ["◀ Back", "✖ Cancel"],
    ]);

    await tap("rt:12:00", chat);
    expect(await deadlineOf(itemId)).toEqual(new Date("2026-03-11T12:00:00Z"));
    expect(lastEdit(api)).toMatchObject({
      text: "📅 <b>pay rent</b>\nmoved to tomorrow, 12:00 PM",
      keyboard: [],
    });
  });

  it("hides times that have already passed today", async () => {
    const { api, userId, bucketId, chat } = await setup();
    const itemId = await seedItem(userId, bucketId, { deadline: T0 });

    await tap(`rs:${itemId}`, chat);
    await tap("rd:today", chat);

    expect(labels(lastEdit(api).keyboard)).toEqual([
      ["3pm", "6pm", "9pm"],
      ["⌨ Type a time"],
      ["◀ Back", "✖ Cancel"],
    ]);
  });

  it("changes only the time from a typed value, asking AM or PM when unclear", async () => {
    const { api, userId, bucketId, chat } = await setup();
    const itemId = await seedItem(userId, bucketId, { deadline: T0 });

    await tap(`rs:${itemId}`, chat);
    await tap("rd:same", chat);
    await tap("rt:type", chat);
    await say("7:30pm", chat);
    expect(await deadlineOf(itemId)).toEqual(new Date("2026-03-10T19:30:00Z"));

    await tap(`rs:${itemId}`, chat);
    await tap("rd:same", chat);
    await tap("rt:type", chat);
    await say("8", chat);
    expect(labels(lastEdit(api).keyboard)[0]).toEqual(["AM", "PM"]);
    await tap("ra:pm", chat);
    expect(await deadlineOf(itemId)).toEqual(new Date("2026-03-10T20:00:00Z"));
  });

  it("refuses a typed time that has already passed", async () => {
    const { api, userId, bucketId, chat } = await setup();
    const itemId = await seedItem(userId, bucketId, { deadline: T0 });

    await tap(`rs:${itemId}`, chat);
    await tap("rd:today", chat);
    await tap("rt:type", chat);
    await say("9am", chat);

    expect(lastEdit(api).text).toContain("That time has already passed");
    expect(await deadlineOf(itemId)).toEqual(T0);
  });

  it("picks any date from the calendar", async () => {
    const { api, userId, bucketId, chat } = await setup();
    const itemId = await seedItem(userId, bucketId, { deadline: T0 });

    await tap(`rs:${itemId}`, chat);
    await tap("rd:pick", chat);
    expect(labels(lastEdit(api).keyboard)[0]).toEqual(["◀", "Mar 2026", "▶"]);
    await tap("ek:2026-03-20", chat);
    await tap("rt:09:00", chat);

    expect(await deadlineOf(itemId)).toEqual(new Date("2026-03-20T09:00:00Z"));
  });

  it("cancel puts the reminder back with its buttons", async () => {
    const { api, userId, bucketId, chat } = await setup();
    const itemId = await seedItem(userId, bucketId, { deadline: T0, title: "pay rent" });

    await tap(`rs:${itemId}`, chat);
    await tap("rx", chat);

    const restored = lastEdit(api);
    expect(restored.text).toMatch(/^⏰ <b>pay rent<\/b>\ndue today, 12:00 PM · Bucket /);
    expect(labels(restored.keyboard)).toEqual([
      ["✓ Done", "🕐 Reschedule"],
      ["15 min", "30 min", "1 hour", "Tomorrow"],
    ]);
    expect(await deadlineOf(itemId)).toEqual(T0);
  });

  it("ignores taps on an older reschedule message", async () => {
    const { api, userId, bucketId, chat } = await setup();
    const itemId = await seedItem(userId, bucketId, { deadline: T0 });

    await tap(`rs:${itemId}`, chat);
    const editsBefore = callsTo(api, "editMessageText").length;
    await tap("rd:tomorrow", chat, ALERT_MESSAGE_ID + 1);

    expect(callsTo(api, "editMessageText")).toHaveLength(editsBefore);
  });

  it("does not re-ping right away when the bucket reminds a day early", async () => {
    const { userId, bucketId, chat } = await setup({ defaultOffsetMins: 24 * 60 });
    // Reminded a day ahead, now two hours overdue
    const itemId = await seedItem(userId, bucketId, {
      deadline: new Date(T0.getTime() - 2 * HOUR),
      notifiedAt: new Date(T0.getTime() - 26 * HOUR),
    });

    await tap(`rs:${itemId}`, chat);
    await tap("rd:tomorrow", chat);
    await tap("rt:10:00", chat);
    await runSchedulerAt(new Date(T0.getTime() + 2 * MINUTE));
    expect(await kindsSent(itemId)).toEqual([]);

    await runSchedulerAt(new Date(T0.getTime() + 22 * HOUR));
    expect(await kindsSent(itemId)).toEqual(["reminder"]);
  });

  it("also runs from the /list item menu and cancels back to it", async () => {
    const { api, userId, bucketId, chat } = await setup();
    const itemId = await seedItem(userId, bucketId, { deadline: T0, title: "pay rent" });
    await setFlowState(
      userId,
      { s: "mg_edit", itemId, itemTitle: "pay rent", bucketId, bucketName: "Bills" },
      ALERT_MESSAGE_ID
    );

    await tap("me:deadline", chat);
    expect(lastEdit(api).text).toMatch(/\n\nWhen\?$/);
    await tap("rx", chat);

    expect(lastEdit(api).text).toMatch(/^<b>pay rent<\/b>\n<i>due today, 12:00 PM · Bucket /);
    const settings = await db.query.userSettings.findFirst({
      where: eq(userSettings.userId, userId),
    });
    expect(getFlowState(settings?.telegramState ?? null)).toMatchObject({ s: "mg_edit", itemId });
  });
});

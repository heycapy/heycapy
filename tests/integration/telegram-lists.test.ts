import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets } from "@/lib/db/schema";
import {
  HOUR,
  resetSchedulerEnvironment,
  seedBucket,
  seedItem,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";
import {
  callsTo,
  connectOwnChat,
  say,
  stubTelegram,
  tap,
  type TelegramApi,
} from "./telegram-helpers";

const T0 = new Date("2026-03-10T12:00:00Z");
const LONG =
  "Pay the electricity bill for the apartment on 5th street before the late fee of the month kicks in";

beforeEach(() => useSchedulerEnvironment(T0));
afterEach(() => resetSchedulerEnvironment());

type Button = { text: string; callback_data: string };
type Sent = { text: string; parse_mode?: string; reply_markup: { inline_keyboard: Button[][] } };

function lastMessage(api: TelegramApi, method = "sendMessage"): Sent {
  const calls = callsTo(api, method);
  return calls[calls.length - 1] as unknown as Sent;
}

async function setup() {
  const api = stubTelegram();
  const userId = await seedUser();
  const bucketId = await seedBucket(userId);
  await db.update(buckets).set({ name: "Bills & <home>" }).where(eq(buckets.id, bucketId));
  const chat = await connectOwnChat(userId);
  return { api, userId, bucketId, chat };
}

describe("item lists", () => {
  it("/list shows full, numbered titles with their date and bucket, and number buttons", async () => {
    const { api, userId, bucketId, chat } = await setup();
    const first = await seedItem(userId, bucketId, {
      deadline: new Date(T0.getTime() + HOUR),
      title: LONG,
    });
    const second = await seedItem(userId, bucketId, {
      deadline: new Date("2026-03-11T00:00:00Z"),
      title: "call mom",
    });

    await say("/list", chat);

    const sent = lastMessage(api);
    expect(sent.parse_mode).toBe("HTML");
    expect(sent.text).toBe(
      [
        "<b>Upcoming · next 7 days</b>",
        `1. ${LONG}\n     <i>today, 1:00 PM · Bills &amp; &lt;home&gt;</i>`,
        "2. call mom\n     <i>tomorrow · Bills &amp; &lt;home&gt;</i>",
        "<i>tap a number to open it</i>",
      ].join("\n\n")
    );
    expect(sent.reply_markup.inline_keyboard).toEqual([
      [
        { text: "1", callback_data: `mi:${first}` },
        { text: "2", callback_data: `mi:${second}` },
      ],
      [{ text: "✖ Close", callback_data: "lc" }],
    ]);
  });

  it("today and overdue use the same layout", async () => {
    const { api, userId, bucketId, chat } = await setup();
    await seedItem(userId, bucketId, {
      deadline: new Date(T0.getTime() + HOUR),
      title: "today thing",
    });
    await seedItem(userId, bucketId, {
      deadline: new Date(T0.getTime() - 26 * HOUR),
      title: "late thing",
    });

    await say("📋 Today", chat);
    expect(lastMessage(api).text).toMatch(/^<b>Due today<\/b>\n\n1\. today thing\n/);

    await say("⚠️ Overdue", chat);
    expect(lastMessage(api).text).toMatch(
      /^<b>Overdue<\/b>\n\n1\. late thing\n     <i>yesterday, 10:00 AM/
    );
  });

  it("pages six at a time and keeps numbering across pages", async () => {
    const { api, userId, bucketId, chat } = await setup();
    const ids: number[] = [];
    for (let i = 0; i < 8; i++) {
      ids.push(
        await seedItem(userId, bucketId, {
          deadline: new Date(T0.getTime() + (i + 1) * HOUR),
          title: `task ${i + 1}`,
        })
      );
    }

    await say("/list", chat);
    const page1 = lastMessage(api);
    expect(page1.text).toMatch(/^<b>Upcoming · next 7 days<\/b> · page 1\/2/);
    expect(page1.reply_markup.inline_keyboard[0]).toHaveLength(6);
    expect(page1.reply_markup.inline_keyboard[1]).toEqual([
      { text: "▶", callback_data: "lp:up:1" },
    ]);

    await tap("lp:up:1", chat, 100);
    const page2 = lastMessage(api, "editMessageText");
    expect(page2.text).toContain("7. task 7");
    expect(page2.text).not.toContain("1. task 1");
    expect(page2.reply_markup.inline_keyboard[0]).toEqual([
      { text: "7", callback_data: `mi:${ids[6]}` },
      { text: "8", callback_data: `mi:${ids[7]}` },
    ]);
    expect(page2.reply_markup.inline_keyboard[1]).toEqual([
      { text: "◀", callback_data: "lp:up:0" },
    ]);
  });

  it("the longest titles still fit one message", async () => {
    const { api, userId, bucketId, chat } = await setup();
    for (let i = 0; i < 7; i++) {
      await seedItem(userId, bucketId, {
        deadline: new Date(T0.getTime() + (i + 1) * HOUR),
        title: `${i}${"x".repeat(499)}`,
      });
    }

    await say("/list", chat);

    expect(lastMessage(api).text.length).toBeLessThan(4096);
  });

  it("a bucket's list leaves out the bucket name", async () => {
    const { api, userId, bucketId, chat } = await setup();
    await seedItem(userId, bucketId, {
      deadline: new Date(T0.getTime() + HOUR),
      title: "pay rent",
    });

    await say("📝 List", chat);

    expect(lastMessage(api).text).toBe(
      [
        "<b>Bills &amp; &lt;home&gt;</b>",
        "1. pay rent\n     <i>today, 1:00 PM</i>",
        "<i>tap a number to open it</i>",
      ].join("\n\n")
    );
  });
});

describe("opening an item from a list", () => {
  it("shows the full title in the menu, in the list that was tapped", async () => {
    const { api, userId, bucketId, chat } = await setup();
    const itemId = await seedItem(userId, bucketId, {
      deadline: new Date(T0.getTime() + HOUR),
      title: LONG,
    });
    await say("/list", chat);
    await say("📋 Today", chat);

    // Tap the item in the first list, not the newest message
    await tap(`mi:${itemId}`, chat, 100);

    const menu = lastMessage(api, "editMessageText") as Sent & { message_id: number };
    expect(menu.message_id).toBe(100);
    expect(menu.text).toBe(`<b>${LONG}</b>\n<i>due today, 1:00 PM · Bills &amp; &lt;home&gt;</i>`);
  });

  it("close just removes the list's buttons", async () => {
    const { api, userId, bucketId, chat } = await setup();
    await seedItem(userId, bucketId, { deadline: new Date(T0.getTime() + HOUR) });
    await say("/list", chat);

    await tap("lc", chat, 100);

    expect(callsTo(api, "editMessageReplyMarkup")).toEqual([
      { chat_id: String(chat), message_id: 100, reply_markup: { inline_keyboard: [] } },
    ]);
    expect(callsTo(api, "sendMessage")).toHaveLength(1);
  });
});

describe("bucket buttons", () => {
  it("ignore a bucket that belongs to someone else", async () => {
    const { api, chat } = await setup();
    const stranger = await seedUser();
    const theirBucket = await seedBucket(stranger);

    await tap(`ab:${theirBucket}`, chat, 100);
    await tap(`lb:${theirBucket}`, chat, 100);

    expect(callsTo(api, "editMessageText").map((e) => e.text)).not.toContainEqual(
      expect.stringMatching(/Adding to|Bucket 0\./)
    );
  });
});

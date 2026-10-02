import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { items, userSettings } from "@/lib/db/schema";
import { getFlowState, setFlowState, type FlowState } from "@/app/api/telegram/telegram-utils";
import {
  resetSchedulerEnvironment,
  seedBucket,
  seedItem,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";
import { ALERT_MESSAGE_ID, callsTo, connectOwnChat, say, stubTelegram } from "./telegram-helpers";

const T0 = new Date("2026-03-10T12:00:00Z");

beforeEach(() => useSchedulerEnvironment(T0));
afterEach(() => resetSchedulerEnvironment());

async function waitingFor(state: (ids: { bucketId: number; itemId: number }) => FlowState) {
  const api = stubTelegram();
  const userId = await seedUser();
  const bucketId = await seedBucket(userId);
  const itemId = await seedItem(userId, bucketId, { deadline: T0, title: "pay rent" });
  const chat = await connectOwnChat(userId);
  await setFlowState(userId, state({ bucketId, itemId }), ALERT_MESSAGE_ID);
  return { api, userId, bucketId, itemId, chat };
}

async function flowOf(userId: number) {
  const row = await db.query.userSettings.findFirst({ where: eq(userSettings.userId, userId) });
  return getFlowState(row?.telegramState ?? null);
}

const WAITING_FOR_TEXT: [string, (ids: { bucketId: number; itemId: number }) => FlowState][] = [
  ["a new item's title", ({ bucketId }) => ({ s: "title", bucketId, bucketName: "Bills" })],
  [
    "a new title for an item",
    ({ bucketId, itemId }) => ({
      s: "mg_edit_title",
      itemId,
      itemTitle: "pay rent",
      bucketId,
      bucketName: "Bills",
    }),
  ],
  [
    "a typed time while adding",
    ({ bucketId }) => ({
      s: "ctime",
      bucketId,
      bucketName: "Bills",
      title: "gym",
      date: "2026-03-10",
    }),
  ],
  [
    "AM or PM while adding",
    ({ bucketId }) => ({
      s: "ctime_ampm",
      bucketId,
      bucketName: "Bills",
      title: "gym",
      date: "2026-03-10",
      hour: 7,
      minute: 0,
    }),
  ],
  [
    "a typed time while rescheduling",
    ({ itemId }) => ({ s: "rs", itemId, origin: "list", date: "2026-03-11", typing: true }),
  ],
];

describe.each(WAITING_FOR_TEXT)("while waiting for %s", (_, state) => {
  it.each(["📝 List", "/list", "📋 Today"])(
    "%s leaves that step and runs instead",
    async (input) => {
      const { api, userId, bucketId, itemId, chat } = await waitingFor(state);

      await say(input, chat);

      expect(await flowOf(userId)).not.toMatchObject({ s: state({ bucketId, itemId })?.s });
      const titles = (await db.select({ title: items.title }).from(items)).map((i) => i.title);
      expect(titles).not.toContain(input);
      expect(callsTo(api, "editMessageReplyMarkup")).toContainEqual(
        expect.objectContaining({
          message_id: ALERT_MESSAGE_ID,
          reply_markup: { inline_keyboard: [] },
        })
      );
      const replies = callsTo(api, "sendMessage").map((m) => String(m.text));
      expect(replies.some((t) => /tap|nothing|due/i.test(t))).toBe(true);
    }
  );
});

it("plain text is still taken as the answer", async () => {
  const { userId, itemId, chat } = await waitingFor(({ bucketId: b, itemId: i }) => ({
    s: "mg_edit_title",
    itemId: i,
    itemTitle: "pay rent",
    bucketId: b,
    bucketName: "Bills",
  }));

  await say("pay rent and water", chat);

  const item = await db.query.items.findFirst({ where: eq(items.id, itemId) });
  expect(item?.title).toBe("pay rent and water");
  expect(await flowOf(userId)).toBeNull();
});

it("leaving a reschedule started on a reminder gives the reminder its buttons back", async () => {
  const { api, itemId, chat } = await waitingFor(({ itemId: i }) => ({
    s: "rs",
    itemId: i,
    origin: "reminder",
    date: "2026-03-11",
    typing: true,
  }));

  await say("📝 List", chat);

  const restore = callsTo(api, "editMessageText").find((e) => e.message_id === ALERT_MESSAGE_ID);
  expect(restore?.reply_markup).toMatchObject({
    inline_keyboard: [
      [{ callback_data: `qc:${itemId}` }, { callback_data: `rs:${itemId}` }],
      expect.any(Array),
    ],
  });
});

import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { signReminderAction, verifyReminderAction } from "@/lib/reminders/action-token";
import { applyReminderAction } from "@/lib/reminders/quick-actions";
import {
  resetSchedulerEnvironment,
  runSchedulerAt,
  seedBucket,
  seedItem,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";
import { callsTo, connectOwnChat, stubTelegram } from "./telegram-helpers";

const T0 = new Date("2026-03-10T12:00:00Z");

const previousSecret = process.env.JWT_SECRET;
beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-at-least-32-characters-long";
});
afterAll(() => {
  process.env.JWT_SECRET = previousSecret;
});
beforeEach(() => useSchedulerEnvironment(T0));
afterEach(() => {
  resetSchedulerEnvironment();
  delete process.env.E2E_TEST_MODE;
});

async function remindedOnTelegram() {
  const api = stubTelegram();
  const userId = await seedUser();
  const chat = await connectOwnChat(userId);
  const bucketId = await seedBucket(userId, { medium: ["telegram"], repeat: "once" });
  const itemId = await seedItem(userId, bucketId, { deadline: T0, title: "pay rent" });
  await runSchedulerAt(T0);
  const [sent] = callsTo(api, "sendMessage");
  expect(sent).toBeDefined();
  return { api, userId, itemId, chat };
}

async function tapFromEmail(userId: number, itemId: number, action: "done" | "15") {
  const claim = verifyReminderAction(
    signReminderAction({ userId, itemId, action, channel: "email", deadline: T0.getTime() })
  );
  if (!claim) throw new Error("token did not verify");
  return applyReminderAction(claim, T0);
}

it("done from email turns the Telegram reminder into done, without its buttons", async () => {
  const { api, userId, itemId, chat } = await remindedOnTelegram();
  await tapFromEmail(userId, itemId, "done");

  const [edit] = callsTo(api, "editMessageText");
  expect(edit).toMatchObject({
    chat_id: String(chat),
    message_id: 100,
    reply_markup: { inline_keyboard: [] },
  });
  expect(edit?.text).toBe("✓ <s>pay rent</s>\ndone\n<i>from email</i>");
});

it("remind again from email says when, on the Telegram reminder", async () => {
  const { api, userId, itemId } = await remindedOnTelegram();
  await tapFromEmail(userId, itemId, "15");

  const [edit] = callsTo(api, "editMessageText");
  expect(edit?.text).toMatch(/^⏰ <b>pay rent<\/b>\nI'll remind you again .*\n<i>from email<\/i>$/);
});

it("leaves Telegram alone during test runs", async () => {
  const { api, userId, itemId } = await remindedOnTelegram();
  process.env.E2E_TEST_MODE = "1";
  await tapFromEmail(userId, itemId, "done");
  expect(callsTo(api, "editMessageText")).toHaveLength(0);
});

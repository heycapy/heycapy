import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { signReminderAction, verifyReminderAction } from "@/lib/reminders/action-token";
import { applyReminderAction } from "@/lib/reminders/quick-actions";
import {
  resetSchedulerEnvironment,
  runSchedulerAt,
  seedBucket,
  seedMember,
  seedItem,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";
import { callsTo, connectOwnChat, stubTelegram, tap } from "./telegram-helpers";

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

describe("in a shared bucket", () => {
  async function bothRemindedOnTelegram() {
    const api = stubTelegram();
    const owner = await seedUser();
    const member = await seedUser();
    const ownerChat = await connectOwnChat(owner);
    const memberChat = await connectOwnChat(member);
    const bucketId = await seedBucket(owner, { medium: ["telegram"], repeat: "once" });
    await seedMember(bucketId, member);
    const itemId = await seedItem(owner, bucketId, { deadline: T0, title: "pay rent" });
    await runSchedulerAt(T0);
    const sent = callsTo(api, "sendMessage");
    const messageIn = (chat: number) => 100 + sent.findIndex((m) => m.chat_id === String(chat));
    return { api, owner, member, itemId, ownerChat, memberChat, messageIn };
  }

  it("done from email changes only the presser's own Telegram reminder", async () => {
    for (const presser of ["owner", "member"] as const) {
      const shared = await bothRemindedOnTelegram();
      const chat = presser === "owner" ? shared.ownerChat : shared.memberChat;
      await tapFromEmail(shared[presser], shared.itemId, "done");

      expect(callsTo(shared.api, "editMessageText")).toMatchObject([
        { chat_id: String(chat), message_id: shared.messageIn(chat) },
      ]);
    }
  });

  it("a member can mark it done from their Telegram reminder", async () => {
    const { api, itemId, memberChat, messageIn } = await bothRemindedOnTelegram();
    await tap(`qc:${itemId}`, memberChat, messageIn(memberChat));

    const item = await db.query.items.findFirst({ where: eq(items.id, itemId) });
    expect(item?.status).toBe("completed");
    expect(callsTo(api, "editMessageText")[0]?.text).toBe("✓ <s>pay rent</s>\ndone");
  });

  it("a member can move it from their Telegram reminder", async () => {
    const { api, itemId, memberChat, messageIn } = await bothRemindedOnTelegram();
    await tap(`rs:${itemId}`, memberChat, messageIn(memberChat));

    expect(callsTo(api, "editMessageText")[0]?.text).toMatch(/\n\nWhen\?$/);
  });
});

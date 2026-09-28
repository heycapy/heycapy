import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { say } from "./telegram-helpers";
import { createTelegramLinkAction, getUserSettingsAction } from "@/app/(app)/user-settings-actions";
import { createTelegramLinkCode } from "@/lib/notifications/telegram-link";
import { MINUTE, resetSchedulerEnvironment, seedUser, useSchedulerEnvironment } from "./helpers";

const session = vi.hoisted(() => ({ userId: 0 }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => session }));

const T0 = new Date("2026-03-10T12:00:00Z");
let chatCounter = 5000;

beforeEach(() => useSchedulerEnvironment(T0));
afterEach(() => {
  delete process.env.E2E_TEST_MODE;
  resetSchedulerEnvironment();
});

async function unconnectedUser(): Promise<number> {
  const userId = await seedUser();
  await db
    .update(userSettings)
    .set({ telegramChatId: null, notificationsTelegram: false })
    .where(eq(userSettings.userId, userId));
  return userId;
}

async function sendStart(text: string, chatId = ++chatCounter): Promise<string> {
  await say(text, chatId);
  return String(chatId);
}

async function chatOf(userId: number): Promise<string | null> {
  const row = await db.query.userSettings.findFirst({ where: eq(userSettings.userId, userId) });
  return row?.telegramChatId ?? null;
}

function lastReply(): string {
  const calls = vi.mocked(fetch).mock.calls;
  const [, init] = calls[calls.length - 1];
  return (JSON.parse(String(init?.body)) as { text: string }).text;
}

it("a plain /start links nothing, even when accounts are waiting to connect", async () => {
  const waiting = await unconnectedUser();

  await sendStart("/start");

  expect(await chatOf(waiting)).toBeNull();
  expect(lastReply()).toContain("open heycapy → tweaks → notifications → [connect]");
});

it("the link connects the chat to the account that asked for it", async () => {
  const bystander = await unconnectedUser();
  const owner = await unconnectedUser();
  const code = await createTelegramLinkCode(owner, T0);

  const chatId = await sendStart(`/start ${code}`);

  expect(await chatOf(owner)).toBe(chatId);
  expect(await chatOf(bystander)).toBeNull();
  expect(lastReply()).toContain("Connected to heycapy ✓");
});

it("a link works only once", async () => {
  const owner = await unconnectedUser();
  const code = await createTelegramLinkCode(owner, T0);
  const first = await sendStart(`/start ${code}`);

  await sendStart(`/start ${code}`);

  expect(await chatOf(owner)).toBe(first);
});

it("an expired or wrong link is refused", async () => {
  const owner = await unconnectedUser();
  const code = await createTelegramLinkCode(owner, T0);

  await sendStart("/start not-the-code");
  vi.setSystemTime(new Date(T0.getTime() + 16 * MINUTE));
  await sendStart(`/start ${code}`);

  expect(await chatOf(owner)).toBeNull();
});

it("a new link replaces the previous one", async () => {
  const owner = await unconnectedUser();
  const old = await createTelegramLinkCode(owner, T0);
  const current = await createTelegramLinkCode(owner, T0);

  await sendStart(`/start ${old}`);
  expect(await chatOf(owner)).toBeNull();

  const chatId = await sendStart(`/start ${current}`);
  expect(await chatOf(owner)).toBe(chatId);
});

it("connecting a chat to another account disconnects it from the first", async () => {
  const first = await unconnectedUser();
  const second = await unconnectedUser();
  const chatId = await sendStart(`/start ${await createTelegramLinkCode(first, T0)}`);

  await sendStart(`/start ${await createTelegramLinkCode(second, T0)}`, Number(chatId));

  expect(await chatOf(first)).toBeNull();
  expect(await chatOf(second)).toBe(chatId);
});

it("the connect action returns a t.me link carrying a fresh code", async () => {
  process.env.E2E_TEST_MODE = "1";
  session.userId = await unconnectedUser();

  const result = await createTelegramLinkAction();

  expect(result).toEqual({
    ok: true,
    url: expect.stringMatching(/^https:\/\/t\.me\/heycapy_test_bot\?start=[A-Za-z0-9_-]{32}$/),
  });
  const code = result.ok ? new URL(result.url).searchParams.get("start") : null;
  const chatId = await sendStart(`/start ${code}`);
  expect(await chatOf(session.userId)).toBe(chatId);
});

it("opening settings reports the bot without calling Telegram or exposing the link code", async () => {
  session.userId = await unconnectedUser();
  await createTelegramLinkCode(session.userId, T0);
  vi.mocked(fetch).mockClear();

  const result = await getUserSettingsAction();

  expect(fetch).not.toHaveBeenCalled();
  expect(result).toMatchObject({
    ok: true,
    telegramBotConfigured: true,
    settings: { telegramLinkCodeHash: null },
  });
});

it("connecting in test mode never calls the real Telegram API", async () => {
  process.env.E2E_TEST_MODE = "1";
  session.userId = await unconnectedUser();
  vi.mocked(fetch).mockClear();

  await createTelegramLinkAction();

  expect(fetch).not.toHaveBeenCalled();
});

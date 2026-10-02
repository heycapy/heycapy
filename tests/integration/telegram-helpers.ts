import { vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { POST } from "@/app/api/telegram/route";
import { telegramWebhookSecret } from "@/lib/notifications/telegram-webhook";

export const ALERT_MESSAGE_ID = 7;

export function stubTelegram() {
  let nextId = 100;
  const api = vi.fn(async (url: string | URL | Request, _init?: RequestInit) => {
    const result = String(url).endsWith("/sendMessage") ? { message_id: nextId++ } : true;
    return new Response(JSON.stringify({ ok: true, result }), { status: 200 });
  });
  vi.stubGlobal("fetch", api);
  return api;
}

export type TelegramApi = ReturnType<typeof stubTelegram>;

export function callsTo(api: TelegramApi, method: string) {
  return api.mock.calls
    .filter(([url]) => String(url).endsWith(`/${method}`))
    .map(([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>);
}

let chatId = 1000;

// Seeded users share a chat id; the bot resolves the user by it
export async function connectOwnChat(userId: number): Promise<number> {
  chatId += 1;
  await db
    .update(userSettings)
    .set({ telegramChatId: String(chatId) })
    .where(eq(userSettings.userId, userId));
  return chatId;
}

async function post(update: unknown) {
  await POST(
    new Request("http://localhost/api/telegram", {
      method: "POST",
      headers: { "X-Telegram-Bot-Api-Secret-Token": telegramWebhookSecret("test-token") },
      body: JSON.stringify(update),
    })
  );
}

export async function tap(data: string, chat: number, messageId = ALERT_MESSAGE_ID) {
  await post({
    callback_query: { id: "cb", data, message: { message_id: messageId, chat: { id: chat } } },
  });
}

export async function say(text: string, chat: number) {
  await post({ message: { text, chat: { id: chat } } });
}

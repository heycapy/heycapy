import { TELEGRAM_API_BASE } from "@/constants";

export type InlineButton = { text: string; callback_data: string };

export async function sendTelegram(
  botToken: string,
  chatId: string,
  message: string
): Promise<void> {
  const res = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API error ${res.status}: ${body}`);
  }
}

export async function sendTelegramButtons(
  botToken: string,
  chatId: string,
  text: string,
  rows: InlineButton[][]
): Promise<void> {
  const res = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: { inline_keyboard: rows },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API error ${res.status}: ${body}`);
  }
}

export async function sendTelegramWithQuickActions(
  botToken: string,
  chatId: string,
  text: string
): Promise<void> {
  const res = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: {
        keyboard: [["➕ Add", "📋 Today", "⚠️ Overdue"]],
        resize_keyboard: true,
        is_persistent: true,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API error ${res.status}: ${body}`);
  }
}

export async function answerCallbackQuery(
  botToken: string,
  callbackQueryId: string
): Promise<void> {
  await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId }),
  }).catch(() => {});
}

export async function sendChatAction(
  botToken: string,
  chatId: string,
  action: "typing"
): Promise<void> {
  await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action }),
  });
}

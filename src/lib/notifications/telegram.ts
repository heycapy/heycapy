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
): Promise<number> {
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
  const data = (await res.json()) as { result: { message_id: number } };
  return data.result.message_id;
}

export async function editTelegramMessage(
  botToken: string,
  chatId: string,
  messageId: number,
  text: string,
  rows: InlineButton[][]
): Promise<void> {
  const res = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      reply_markup: { inline_keyboard: rows },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (body.includes("message is not modified")) return;
    throw new Error(`Telegram editMessageText error ${res.status}: ${body}`);
  }
}

export async function removeMessageButtons(
  botToken: string,
  chatId: string,
  messageId: number
): Promise<void> {
  await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/editMessageReplyMarkup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: [] },
    }),
  }).catch(() => {});
}

export async function sendOrEditButtons(
  botToken: string,
  chatId: string,
  messageId: number | null | undefined,
  text: string,
  rows: InlineButton[][]
): Promise<number> {
  if (messageId) {
    await editTelegramMessage(botToken, chatId, messageId, text, rows);
    return messageId;
  }
  return sendTelegramButtons(botToken, chatId, text, rows);
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
        keyboard: [
          ["➕ Add", "📝 List"],
          ["📋 Today", "⚠️ Overdue"],
        ],
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

export async function sendTelegramItemNotification(
  botToken: string,
  chatId: string,
  text: string,
  itemId: number
): Promise<void> {
  const res = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✓ Done", callback_data: `qc:${itemId}` },
            { text: "📅 Update deadline", callback_data: `qu:${itemId}` },
          ],
        ],
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

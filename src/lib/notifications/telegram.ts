import { TELEGRAM_API_BASE } from "@/constants";
import { errorMessage } from "@/lib/errors";
import { QUICK_REMIND_OPTIONS, TELEGRAM_KEYBOARD, type QuickRemindChoice } from "./constants";

export type InlineButton = { text: string; callback_data: string };

async function callTelegram(botToken: string, method: string, body: object): Promise<Response> {
  const res = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Telegram ${method} error ${res.status}: ${await res.text()}`);
  }
  return res;
}

async function sendMessage(botToken: string, body: object): Promise<number> {
  const res = await callTelegram(botToken, "sendMessage", body);
  const data = (await res.json()) as { result: { message_id: number } };
  return data.result.message_id;
}

async function editMessage(botToken: string, body: object): Promise<void> {
  try {
    await callTelegram(botToken, "editMessageText", body);
  } catch (err) {
    if (!errorMessage(err).includes("message is not modified")) throw err;
  }
}

// Cleanup calls: a failure here must never fail the user's action
async function bestEffort(botToken: string, method: string, body: object): Promise<void> {
  await callTelegram(botToken, method, body).catch(() => {});
}

export async function sendTelegram(botToken: string, chatId: string, message: string) {
  await callTelegram(botToken, "sendMessage", { chat_id: chatId, text: message });
}

export function sendTelegramButtons(
  botToken: string,
  chatId: string,
  text: string,
  rows: InlineButton[][]
): Promise<number> {
  return sendMessage(botToken, { chat_id: chatId, text, reply_markup: { inline_keyboard: rows } });
}

export function sendTelegramHtml(
  botToken: string,
  chatId: string,
  html: string,
  rows: InlineButton[][]
): Promise<number> {
  return sendMessage(botToken, {
    chat_id: chatId,
    text: html,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: rows },
  });
}

export function sendTelegramItemNotification(
  botToken: string,
  chatId: string,
  html: string,
  itemId: number,
  picks: QuickRemindChoice[]
): Promise<number> {
  return sendTelegramHtml(botToken, chatId, html, reminderButtons(itemId, picks));
}

export async function sendTelegramWithQuickActions(botToken: string, chatId: string, text: string) {
  await callTelegram(botToken, "sendMessage", {
    chat_id: chatId,
    text,
    reply_markup: { keyboard: TELEGRAM_KEYBOARD, resize_keyboard: true, is_persistent: true },
  });
}

export function editTelegramMessage(
  botToken: string,
  chatId: string,
  messageId: number,
  text: string,
  rows: InlineButton[][]
): Promise<void> {
  return editMessage(botToken, {
    chat_id: chatId,
    message_id: messageId,
    text,
    reply_markup: { inline_keyboard: rows },
  });
}

export function editTelegramHtml(
  botToken: string,
  chatId: string,
  messageId: number,
  html: string,
  rows: InlineButton[][] = []
): Promise<void> {
  return editMessage(botToken, {
    chat_id: chatId,
    message_id: messageId,
    text: html,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: rows },
  });
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

export function reminderButtons(itemId: number, picks: QuickRemindChoice[]): InlineButton[][] {
  const remind = QUICK_REMIND_OPTIONS.filter((o) => picks.includes(o.value)).map((o) => ({
    text: o.label,
    callback_data: `rq:${itemId}:${o.value}`,
  }));
  return [
    [
      { text: "✓ Done", callback_data: `qc:${itemId}` },
      { text: "🕐 Reschedule", callback_data: `rs:${itemId}` },
    ],
    ...(remind.length > 0 ? [remind] : []),
  ];
}

export function removeMessageButtons(botToken: string, chatId: string, messageId: number) {
  return bestEffort(botToken, "editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: [] },
  });
}

// Telegram refuses deletes after 48 hours
export function deleteTelegramMessage(botToken: string, chatId: string, messageId: number) {
  return bestEffort(botToken, "deleteMessage", { chat_id: chatId, message_id: messageId });
}

export function answerCallbackQuery(botToken: string, callbackQueryId: string) {
  return bestEffort(botToken, "answerCallbackQuery", { callback_query_id: callbackQueryId });
}

export function sendChatAction(botToken: string, chatId: string, action: "typing") {
  return bestEffort(botToken, "sendChatAction", { chat_id: chatId, action });
}

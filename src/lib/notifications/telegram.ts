import { TELEGRAM_API_BASE } from "@/constants";

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

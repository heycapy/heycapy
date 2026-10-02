import { createHmac, timingSafeEqual } from "node:crypto";

// Sent by Telegram in a header on every update; derived so there is nothing extra to store
export function telegramWebhookSecret(botToken: string): string {
  return createHmac("sha256", botToken).update("heycapy-telegram-webhook").digest("hex");
}

export function isTelegramWebhookSecret(botToken: string, received: string): boolean {
  const expected = Buffer.from(telegramWebhookSecret(botToken));
  const actual = Buffer.from(received);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { WEBHOOK_SECRET_PREFIX } from "@/constants";
import { postJson } from "./post-json";
import { webhookBody, type WebhookEvent } from "./webhook-app";

// Standard Webhooks (standardwebhooks.com): secret, headers and signature in that shape,
// so receivers can verify with any of its libraries

export function newWebhookSecret(): string {
  return WEBHOOK_SECRET_PREFIX + randomBytes(32).toString("base64");
}

export function newWebhookMessageId(): string {
  return `msg_${randomUUID().replaceAll("-", "")}`;
}

export function signWebhook(secret: string, id: string, timestamp: number, body: string): string {
  const key = Buffer.from(secret.slice(WEBHOOK_SECRET_PREFIX.length), "base64");
  const signature = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
  return `v1,${signature}`;
}

// id stays the same on every retry so receivers can drop repeats; the timestamp is per attempt
export async function sendWebhook(
  url: string,
  secret: string,
  id: string,
  event: WebhookEvent,
  message: string
): Promise<void> {
  const body = webhookBody(url, event, message);
  const timestamp = Math.floor(Date.now() / 1000);
  const { status, text } = await postJson(new URL(url), body, {
    "webhook-id": id,
    "webhook-timestamp": String(timestamp),
    "webhook-signature": signWebhook(secret, id, timestamp, body),
  });
  if (status < 200 || status >= 300) {
    throw new Error(`webhook error ${status}: ${text.slice(0, 200)}`);
  }
}

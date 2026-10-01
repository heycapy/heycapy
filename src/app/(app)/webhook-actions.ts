"use server";

import type { ActionResult } from "@/types/result";
import { revalidatePath } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { outgoingWebhooks } from "@/lib/db/schema";
import { decryptValue, encryptValue } from "@/lib/crypto";
import { publicAddress } from "@/lib/notifications/public-address";
import { newWebhookMessageId, newWebhookSecret, sendWebhook } from "@/lib/notifications/webhook";
import { isE2ETestMode } from "@/lib/e2e";
import { errorMessage } from "@/lib/errors";
import {
  APP_NAME,
  MAX_OUTGOING_WEBHOOKS,
  SETTINGS_URL_MAX_LENGTH,
  WEBHOOK_NAME_MAX_LENGTH,
} from "@/constants";

export type OutgoingWebhook = {
  id: number;
  name: string;
  url: string;
  secret: string;
  isDefault: boolean;
};

const WebhookInput = z.object({
  id: z.number().int().positive().nullable(),
  name: z.string().trim().min(1, "give it a name").max(WEBHOOK_NAME_MAX_LENGTH),
  url: z.string().trim().min(1, "enter a url").max(SETTINGS_URL_MAX_LENGTH),
  isDefault: z.boolean(),
});

async function userWebhooks(userId: number): Promise<OutgoingWebhook[]> {
  const rows = await db
    .select()
    .from(outgoingWebhooks)
    .where(eq(outgoingWebhooks.userId, userId))
    .orderBy(asc(outgoingWebhooks.id));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    url: row.url,
    secret: decryptValue(row.secret),
    isDefault: row.isDefault,
  }));
}

export async function getWebhooksAction(): Promise<ActionResult<{ webhooks: OutgoingWebhook[] }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };
  return { ok: true, webhooks: await userWebhooks(session.userId) };
}

export async function saveWebhookAction(
  input: z.input<typeof WebhookInput>
): Promise<ActionResult<{ webhook: OutgoingWebhook }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };
  const parsed = WebhookInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { id, name, url, isDefault } = parsed.data;

  const existing = await userWebhooks(session.userId);
  const saved = id === null ? undefined : existing.find((w) => w.id === id);
  if (id !== null && !saved) return { ok: false, error: "webhook not found" };
  if (!saved && existing.length >= MAX_OUTGOING_WEBHOOKS) {
    return { ok: false, error: `you can have up to ${MAX_OUTGOING_WEBHOOKS} webhooks` };
  }
  if (existing.some((w) => w.id !== id && w.name.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: `you already have a webhook called ${name}` };
  }

  if (url !== saved?.url) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return { ok: false, error: "url is not valid" };
    }
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      return { ok: false, error: "url must start with http:// or https://" };
    }
    try {
      await publicAddress(parsedUrl.hostname);
    } catch (err) {
      return { ok: false, error: errorMessage(err) };
    }
  }

  if (saved) {
    await db
      .update(outgoingWebhooks)
      .set({ name, url, isDefault })
      .where(and(eq(outgoingWebhooks.id, saved.id), eq(outgoingWebhooks.userId, session.userId)));
    revalidatePath("/");
    return { ok: true, webhook: { ...saved, name, url, isDefault } };
  }

  const secret = newWebhookSecret();
  const [row] = await db
    .insert(outgoingWebhooks)
    .values({ userId: session.userId, name, url, isDefault, secret: encryptValue(secret) })
    .returning({ id: outgoingWebhooks.id });
  revalidatePath("/");
  return { ok: true, webhook: { id: row.id, name, url, secret, isDefault } };
}

export async function deleteWebhookAction(id: number): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };
  await db
    .delete(outgoingWebhooks)
    .where(and(eq(outgoingWebhooks.id, id), eq(outgoingWebhooks.userId, session.userId)));
  revalidatePath("/");
  return { ok: true };
}

export async function newWebhookSecretAction(
  id: number
): Promise<ActionResult<{ secret: string }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };
  const secret = newWebhookSecret();
  const updated = await db
    .update(outgoingWebhooks)
    .set({ secret: encryptValue(secret) })
    .where(and(eq(outgoingWebhooks.id, id), eq(outgoingWebhooks.userId, session.userId)))
    .returning({ id: outgoingWebhooks.id });
  if (updated.length === 0) return { ok: false, error: "webhook not found" };
  revalidatePath("/");
  return { ok: true, secret };
}

export async function sendTestWebhookAction(id: number): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };
  const webhook = (await userWebhooks(session.userId)).find((w) => w.id === id);
  if (!webhook) return { ok: false, error: "save the webhook first" };

  try {
    if (!isE2ETestMode()) {
      await sendWebhook(
        webhook.url,
        webhook.secret,
        newWebhookMessageId(),
        {
          type: "test",
          timestamp: new Date().toISOString(),
          data: { message: "your webhook is working", webhook: webhook.name },
        },
        `[${APP_NAME}] test: your webhook is working`
      );
    }
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  return { ok: true };
}

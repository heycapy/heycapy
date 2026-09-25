"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { getSession, deleteSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { encryptValue, decryptValue } from "@/lib/crypto";
import { TELEGRAM_API_BASE } from "@/constants";

type UserSettingsUpdate = {
  personalityName: string;
  personalityTone: "chill" | "professional" | "motivational" | "custom";
  personalityEmoji: boolean;
  personalityCustomPrompt: string | null;
  timezone: string;
  aiProvider: "ollama" | "openai" | "anthropic" | "groq" | "gemini" | null;
  aiApiKey: string | null;
  aiModel: string | null;
  aiOllamaUrl: string | null;
  aiCompactThreshold: number;
  aiNotifyMessages: boolean;
  notificationsEmail: boolean;
  notificationsPush: boolean;
  ntfyUrl: string | null;
  ntfyTopic: string | null;
  notificationsTelegram: boolean;
  transcriptionProvider: string | null;
  transcriptionApiKey: string | null;
  transcriptionModel: string | null;
  emailProvider: string | null;
  resendApiKey: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpPass: string | null;
  smtpSecure: boolean;
  smtpFrom: string | null;
};

export async function getUserSettingsAction(): Promise<
  { ok: true; settings: typeof userSettings.$inferSelect } | { ok: false; error: string }
> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };

  const settings = await db.query.userSettings.findFirst({
    where: (s, { eq: qeq }) => qeq(s.userId, session.userId),
  });
  if (!settings) return { ok: false, error: "Settings not found" };

  return {
    ok: true,
    settings: {
      ...settings,
      aiApiKey: settings.aiApiKey ? decryptValue(settings.aiApiKey) : null,
      transcriptionApiKey: settings.transcriptionApiKey
        ? decryptValue(settings.transcriptionApiKey)
        : null,
      resendApiKey: settings.resendApiKey ? decryptValue(settings.resendApiKey) : null,
      smtpPass: settings.smtpPass ? decryptValue(settings.smtpPass) : null,
    },
  };
}

export async function updateUserSettingsAction(
  data: UserSettingsUpdate
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };

  const trimmedName = data.personalityName.trim();
  if (!trimmedName) return { ok: false, error: "Name is required" };
  if (trimmedName.length > 50) return { ok: false, error: "Name too long" };

  await db
    .update(userSettings)
    .set({
      personalityName: trimmedName,
      personalityTone: data.personalityTone,
      personalityEmoji: data.personalityEmoji,
      personalityCustomPrompt: data.personalityCustomPrompt || null,
      timezone: data.timezone || "UTC",
      aiProvider: data.aiProvider,
      aiApiKey: data.aiApiKey ? encryptValue(data.aiApiKey) : null,
      aiModel: data.aiModel || null,
      aiOllamaUrl: data.aiOllamaUrl || null,
      aiCompactThreshold: data.aiCompactThreshold,
      aiNotifyMessages: data.aiNotifyMessages,
      notificationsEmail: data.notificationsEmail,
      notificationsPush: data.notificationsPush,
      ntfyUrl: data.ntfyUrl || null,
      ntfyTopic: data.ntfyTopic || null,
      notificationsTelegram: data.notificationsTelegram,
      transcriptionProvider: data.transcriptionProvider || null,
      transcriptionApiKey: data.transcriptionApiKey ? encryptValue(data.transcriptionApiKey) : null,
      transcriptionModel: data.transcriptionModel || null,
      emailProvider: data.emailProvider || null,
      resendApiKey: data.resendApiKey ? encryptValue(data.resendApiKey) : null,
      smtpHost: data.smtpHost || null,
      smtpPort: data.smtpPort || null,
      smtpUser: data.smtpUser || null,
      smtpPass: data.smtpPass ? encryptValue(data.smtpPass) : null,
      smtpSecure: data.smtpSecure,
      smtpFrom: data.smtpFrom || null,
      updatedAt: new Date(),
    })
    .where(eq(userSettings.userId, session.userId));

  return { ok: true };
}

export async function logoutAction() {
  await deleteSession();
  redirect("/login");
}

export async function setupTelegramAction(): Promise<
  { ok: true; botUsername: string } | { ok: false; error: string }
> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return { ok: false, error: "TELEGRAM_BOT_TOKEN is not set in .env" };

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const appUrl = process.env.APP_URL ?? `${proto}://${host}`;
  const webhookUrl = `${appUrl}/api/telegram?secret=${encodeURIComponent(botToken)}`;

  try {
    const [webhookRes, meRes] = await Promise.all([
      fetch(`${TELEGRAM_API_BASE}/bot${botToken}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl }),
      }),
      fetch(`${TELEGRAM_API_BASE}/bot${botToken}/getMe`),
    ]);

    if (!meRes.ok) return { ok: false, error: "Invalid bot token — check TELEGRAM_BOT_TOKEN" };

    type TelegramMeResult = { ok: boolean; result?: { username?: string } };
    const meJson = (await meRes.json()) as TelegramMeResult;
    const botUsername = meJson.result?.username ?? "your bot";

    if (!webhookRes.ok) {
      return { ok: false, error: `Webhook registration failed — check APP_URL in .env` };
    }

    return { ok: true, botUsername };
  } catch {
    return { ok: false, error: "Could not reach Telegram API" };
  }
}

export async function disconnectTelegramAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };

  await db
    .update(userSettings)
    .set({ telegramChatId: null, notificationsTelegram: false })
    .where(eq(userSettings.userId, session.userId));

  revalidatePath("/");
  return { ok: true };
}

export async function getNotifAvailabilityAction(): Promise<{
  email: boolean;
  ntfy: boolean;
  telegram: boolean;
}> {
  const session = await getSession();
  if (!session) return { email: false, ntfy: false, telegram: false };

  const settings = await db.query.userSettings.findFirst({
    where: (s, { eq: qeq }) => qeq(s.userId, session.userId),
  });
  if (!settings) return { email: false, ntfy: false, telegram: false };

  const emailConfigured =
    !!process.env.RESEND_API_KEY ||
    !!process.env.SMTP_HOST ||
    (settings.emailProvider === "resend" && !!settings.resendApiKey) ||
    (settings.emailProvider === "smtp" && !!settings.smtpHost);

  return {
    email: settings.notificationsEmail && emailConfigured,
    ntfy: settings.notificationsPush && !!settings.ntfyUrl && !!settings.ntfyTopic,
    telegram: settings.notificationsTelegram && !!settings.telegramChatId,
  };
}

export async function registerTelegramWebhookAction(
  botToken: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };

  if (!botToken.trim()) return { ok: false, error: "Bot token is required" };

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const appUrl = process.env.APP_URL ?? `${proto}://${host}`;
  const webhookUrl = `${appUrl}/api/telegram?secret=${encodeURIComponent(botToken)}`;

  try {
    const res = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl }),
    });
    const data = (await res.json()) as { ok: boolean; description?: string };
    if (!data.ok) return { ok: false, error: data.description ?? "Telegram rejected the request" };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

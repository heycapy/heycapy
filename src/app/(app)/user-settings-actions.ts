"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { getSession, deleteSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users, userSettings } from "@/lib/db/schema";
import { encryptValue, decryptValue } from "@/lib/crypto";
import { refreshUserReminders } from "@/lib/reminders/refresh";
import { getWorkingChannels } from "@/lib/notifications/channels";
import { TELEGRAM_API_BASE } from "@/constants";
import { sendEmail } from "@/lib/notifications/email";
import { APP_NAME } from "@/constants";

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
  notificationEmailTo: string | null;
  notificationsPush: boolean;
  ntfyUrl: string | null;
  ntfyTopic: string | null;
  notificationsTelegram: boolean;
  transcriptionProvider: string | null;
  transcriptionApiKey: string | null;
  transcriptionModel: string | null;
  emailProvider: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpPass: string | null;
  smtpSecure: boolean;
  smtpFrom: string | null;
};

export async function getUserSettingsAction(): Promise<
  | {
      ok: true;
      settings: typeof userSettings.$inferSelect;
      userEmail: string;
      smtpPassSaved: boolean;
    }
  | { ok: false; error: string }
> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };

  const [settings, user] = await Promise.all([
    db.query.userSettings.findFirst({
      where: (s, { eq: qeq }) => qeq(s.userId, session.userId),
    }),
    db.query.users.findFirst({ where: eq(users.id, session.userId) }),
  ]);
  if (!settings) return { ok: false, error: "Settings not found" };

  return {
    ok: true,
    userEmail: user?.email ?? session.email,
    smtpPassSaved: !!settings.smtpPass,
    settings: {
      ...settings,
      aiApiKey: settings.aiApiKey ? decryptValue(settings.aiApiKey) : null,
      transcriptionApiKey: settings.transcriptionApiKey
        ? decryptValue(settings.transcriptionApiKey)
        : null,
      smtpPass: null, // never expose — write-only
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
      notificationEmailTo: data.notificationEmailTo || null,
      notificationsPush: data.notificationsPush,
      ntfyUrl: data.ntfyUrl || null,
      ntfyTopic: data.ntfyTopic || null,
      notificationsTelegram: data.notificationsTelegram,
      transcriptionProvider: data.transcriptionProvider || null,
      transcriptionApiKey: data.transcriptionApiKey ? encryptValue(data.transcriptionApiKey) : null,
      transcriptionModel: data.transcriptionModel || null,
      emailProvider: data.emailProvider || null,
      smtpHost: data.smtpHost || null,
      smtpPort: data.smtpPort || null,
      smtpUser: data.smtpUser || null,
      ...(data.smtpPass ? { smtpPass: encryptValue(data.smtpPass) } : {}),
      smtpSecure: data.smtpSecure,
      smtpFrom: data.smtpFrom || null,
      updatedAt: new Date(),
    })
    .where(eq(userSettings.userId, session.userId));
  await refreshUserReminders(session.userId);

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

  const working = await getWorkingChannels(session.userId);
  return {
    email: working.includes("email"),
    ntfy: working.includes("ntfy"),
    telegram: working.includes("telegram"),
  };
}

export async function saveTimezoneIfDefaultAction(timezone: string): Promise<void> {
  const session = await getSession();
  if (!session) return;
  if (!timezone || timezone === "UTC") return;
  const updated = await db
    .update(userSettings)
    .set({ timezone })
    .where(and(eq(userSettings.userId, session.userId), eq(userSettings.timezone, "UTC")))
    .returning({ userId: userSettings.userId });
  if (updated.length > 0) await refreshUserReminders(session.userId);
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

export async function testSmtpAction(config: {
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPass: string | null; // null = use saved encrypted value from DB
  smtpSecure: boolean;
  sendTo: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };

  if (!config.smtpHost) return { ok: false, error: "SMTP host is required" };
  if (!config.sendTo) return { ok: false, error: "Recipient email is required" };

  const parsedPort = config.smtpPort ? parseInt(config.smtpPort, 10) : null;

  let smtpPass: string | null = config.smtpPass;
  if (!smtpPass) {
    const saved = await db.query.userSettings.findFirst({
      where: eq(userSettings.userId, session.userId),
    });
    smtpPass = saved?.smtpPass ? decryptValue(saved.smtpPass) : null;
  }

  try {
    await sendEmail(
      {
        to: config.sendTo,
        subject: `[${APP_NAME}] smtp test`,
        text: `your smtp is working correctly — sent while relaxing`,
        html: `<!DOCTYPE html><html><body style="margin:0;padding:40px 16px;background:#fdf6e3;font-family:'Courier New',Courier,monospace;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fdf6e3;border:2px solid #2c1f0e;"><tr><td style="padding:20px 32px 16px;border-bottom:1px solid #2c1f0e;"><p style="margin:0;font-size:18px;font-weight:700;color:#2c1f0e;">[ ${APP_NAME} ]</p><p style="margin:4px 0 0;font-size:11px;color:#7a6a55;letter-spacing:0.05em;">smtp test</p></td></tr><tr><td style="padding:24px 32px 24px;"><p style="margin:0;font-size:14px;color:#2c1f0e;line-height:1.6;">your smtp is working correctly.</p></td></tr><tr><td style="padding:16px 32px 20px;border-top:1px solid #2c1f0e;"><p style="margin:0;font-size:11px;color:#7a6a55;">your capy &mdash; sent while relaxing</p></td></tr></table></td></tr></table></body></html>`,
      },
      {
        emailProvider: "smtp",
        smtpHost: config.smtpHost,
        smtpPort: parsedPort && !isNaN(parsedPort) ? parsedPort : null,
        smtpUser: config.smtpUser || null,
        smtpPass,
        smtpSecure: config.smtpSecure,
        smtpFrom: config.smtpUser || null,
      }
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to send test email" };
  }
}

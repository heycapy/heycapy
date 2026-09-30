"use server";

import type { ActionResult } from "@/types/result";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq, sql } from "drizzle-orm";
import { getSession, deleteSession } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/admin";
import { isHosted } from "@/lib/credits";
import { db } from "@/lib/db";
import { users, userSettings } from "@/lib/db/schema";
import { encryptValue, decryptValue } from "@/lib/crypto";
import { refreshUserReminders } from "@/lib/reminders/refresh";
import { parseClock } from "@/lib/reminders/zoned";
import { ALL_CHANNELS, getWorkingChannels } from "@/lib/notifications/channels";
import { TELEGRAM_API_BASE, TELEGRAM_LINK_BASE } from "@/constants";
import { sendEmail } from "@/lib/notifications/email";
import { sendNtfy } from "@/lib/notifications/ntfy";
import { sendWebPush } from "@/lib/notifications/web-push";
import { sendTelegram } from "@/lib/notifications/telegram";
import { dismissChannelFailures } from "@/lib/notifications/failures";
import { createTelegramLinkCode } from "@/lib/notifications/telegram-link";
import { telegramWebhookSecret } from "@/lib/notifications/telegram-webhook";
import type { NotificationMedium } from "@/lib/notifications/queue";
import { isE2ETestMode } from "@/lib/e2e";
import { errorMessage } from "@/lib/errors";
import {
  AI_COMPACT_THRESHOLD_MAX,
  AI_COMPACT_THRESHOLD_MIN,
  APP_NAME,
  EMAIL_COLORS,
} from "@/constants";
import { emailLayout } from "@/lib/email/layout";

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
  aiUseOwnKey: boolean;
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
  ActionResult<{
    settings: typeof userSettings.$inferSelect;
    userEmail: string;
    smtpPassSaved: boolean;
    telegramBotConfigured: boolean;
    isAdmin: boolean;
    hosted: boolean;
  }>
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
    telegramBotConfigured: !!process.env.TELEGRAM_BOT_TOKEN,
    isAdmin: isAdmin(session.email),
    hosted: isHosted(),
    settings: {
      ...settings,
      aiApiKey: settings.aiApiKey ? decryptValue(settings.aiApiKey) : null,
      transcriptionApiKey: settings.transcriptionApiKey
        ? decryptValue(settings.transcriptionApiKey)
        : null,
      smtpPass: null, // never expose — write-only
      telegramLinkCodeHash: null,
    },
  };
}

export async function updateUserSettingsAction(
  data: UserSettingsUpdate
): Promise<ActionResult<{ aiChanged: boolean }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };

  const trimmedName = data.personalityName.trim();
  if (!trimmedName) return { ok: false, error: "Name is required" };
  if (trimmedName.length > 50) return { ok: false, error: "Name too long" };
  if (
    !Number.isInteger(data.aiCompactThreshold) ||
    data.aiCompactThreshold < AI_COMPACT_THRESHOLD_MIN ||
    data.aiCompactThreshold > AI_COMPACT_THRESHOLD_MAX
  ) {
    return {
      ok: false,
      error: `Autocompact must be a whole number from ${AI_COMPACT_THRESHOLD_MIN} to ${AI_COMPACT_THRESHOLD_MAX}`,
    };
  }

  if (isHosted() && data.aiProvider === "ollama") {
    return { ok: false, error: "Ollama isn't available here. Pick another provider." };
  }

  const saved = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, session.userId),
  });
  const aiChanged =
    saved?.aiProvider !== data.aiProvider ||
    (saved.aiApiKey ? decryptValue(saved.aiApiKey) : null) !== (data.aiApiKey || null) ||
    saved.aiModel !== (data.aiModel || null) ||
    saved.aiOllamaUrl !== (data.aiOllamaUrl || null) ||
    saved.aiUseOwnKey !== data.aiUseOwnKey;

  await db
    .update(userSettings)
    .set({
      ...(aiChanged ? { aiKeyStatus: null, aiKeyError: null, aiKeyCheckedAt: null } : {}),
      personalityName: trimmedName,
      personalityTone: data.personalityTone,
      personalityEmoji: data.personalityEmoji,
      personalityCustomPrompt: data.personalityCustomPrompt || null,
      timezone: data.timezone || "UTC",
      aiProvider: data.aiProvider,
      aiApiKey: data.aiApiKey ? encryptValue(data.aiApiKey) : null,
      aiModel: data.aiModel || null,
      aiOllamaUrl: data.aiOllamaUrl || null,
      aiUseOwnKey: data.aiUseOwnKey,
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
  revalidatePath("/");

  return { ok: true, aiChanged };
}

export async function logoutAction() {
  await deleteSession();
  redirect("/login");
}

// Ends every session of this user, on every device, including this one
export async function logoutEverywhereAction() {
  const session = await getSession();
  if (session) {
    await db
      .update(users)
      .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
      .where(eq(users.id, session.userId));
  }
  await deleteSession();
  redirect("/login");
}

export async function setupTelegramAction(): Promise<ActionResult<{ botUsername: string }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return { ok: false, error: "TELEGRAM_BOT_TOKEN is not set in .env" };
  // Tests must never repoint the real bot
  if (isE2ETestMode()) return { ok: true, botUsername: "heycapy_test_bot" };

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const appUrl = process.env.APP_URL ?? `${proto}://${host}`;
  const webhookUrl = `${appUrl}/api/telegram`;

  try {
    const [webhookRes, meRes] = await Promise.all([
      fetch(`${TELEGRAM_API_BASE}/bot${botToken}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl, secret_token: telegramWebhookSecret(botToken) }),
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

export async function createTelegramLinkAction(): Promise<ActionResult<{ url: string }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };

  const setup = await setupTelegramAction();
  if (!setup.ok) return setup;
  const code = await createTelegramLinkCode(session.userId);
  return { ok: true, url: `${TELEGRAM_LINK_BASE}/${setup.botUsername}?start=${code}` };
}

export async function disconnectTelegramAction(): Promise<ActionResult> {
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
  push: boolean;
}> {
  const session = await getSession();
  if (!session) return { email: false, ntfy: false, telegram: false, push: false };

  const working = await getWorkingChannels(session.userId);
  return {
    email: working.includes("email"),
    ntfy: working.includes("ntfy"),
    telegram: working.includes("telegram"),
    push: working.includes("push"),
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

export async function testSmtpAction(config: {
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPass: string | null; // null = use saved encrypted value from DB
  smtpSecure: boolean;
  sendTo: string;
}): Promise<ActionResult> {
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
        text: "your smtp is working correctly.",
        html: emailLayout({
          label: "smtp test",
          preheader: "your smtp is working correctly",
          body: `<p style="margin:0;font-size:14px;line-height:1.6;color:${EMAIL_COLORS.text};">your smtp is working correctly.</p>`,
        }),
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
    await clearFailuresAfterTest(session.userId, "email");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to send test email" };
  }
}

export async function sendTestNotificationAction(
  channel: "ntfy" | "telegram" | "push",
  ntfy?: { url: string; topic: string }
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };

  const title = `[${APP_NAME}] test`;
  const message = "your notifications are working";

  let send: () => Promise<void>;
  if (channel === "ntfy") {
    const url = ntfy?.url.trim() ?? "";
    const topic = ntfy?.topic.trim() ?? "";
    if (!url || !topic) return { ok: false, error: "enter a server url and topic first" };
    let protocol: string;
    try {
      protocol = new URL(url).protocol;
    } catch {
      return { ok: false, error: "server url is not valid" };
    }
    if (protocol !== "https:" && protocol !== "http:") {
      return { ok: false, error: "server url must start with http:// or https://" };
    }
    send = () => sendNtfy(url, topic, title, message);
  } else if (channel === "push") {
    const userId = session.userId;
    send = () => sendWebPush(userId, { title, body: message });
  } else {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const settings = await db.query.userSettings.findFirst({
      where: eq(userSettings.userId, session.userId),
    });
    if (!botToken) return { ok: false, error: "telegram isn't enabled on this server" };
    if (!settings?.telegramChatId) return { ok: false, error: "connect telegram first" };
    const chatId = settings.telegramChatId;
    send = () => sendTelegram(botToken, chatId, `${title}\n${message}`);
  }

  try {
    if (!isE2ETestMode()) await send();
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  await clearFailuresAfterTest(session.userId, channel);
  return { ok: true };
}

async function clearFailuresAfterTest(userId: number, medium: NotificationMedium): Promise<void> {
  await dismissChannelFailures(userId, medium);
  revalidatePath("/");
}

export async function dismissDeliveryFailuresAction(medium: NotificationMedium): Promise<void> {
  const session = await getSession();
  if (!session || !ALL_CHANNELS.includes(medium)) return;
  await dismissChannelFailures(session.userId, medium);
  revalidatePath("/");
}

export async function getQuietHoursAction(): Promise<
  ActionResult<{ from: string | null; to: string | null }>
> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };
  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, session.userId),
    columns: { quietHoursFrom: true, quietHoursTo: true },
  });
  return { ok: true, from: settings?.quietHoursFrom ?? null, to: settings?.quietHoursTo ?? null };
}

export async function saveQuietHoursAction(
  from: string | null,
  to: string | null
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };
  const off = from === null && to === null;
  const valid =
    from !== null && to !== null && parseClock(from) !== null && parseClock(to) !== null;
  if (!off && !valid) return { ok: false, error: "quiet hours need a start and an end time" };
  if (valid && parseClock(from) === parseClock(to)) {
    return { ok: false, error: "start and end can't be the same time" };
  }

  await db
    .update(userSettings)
    .set({ quietHoursFrom: from, quietHoursTo: to, updatedAt: new Date() })
    .where(eq(userSettings.userId, session.userId));
  await refreshUserReminders(session.userId);
  revalidatePath("/");
  return { ok: true };
}

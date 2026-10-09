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
import { ALL_CHANNELS, getChannelSettings, workingChannels } from "@/lib/notifications/channels";
import { sendEmail } from "@/lib/notifications/email";
import { sendNtfy } from "@/lib/notifications/ntfy";
import { publicAddress } from "@/lib/notifications/public-address";
import { sendWebPush } from "@/lib/notifications/web-push";
import { sendTelegram } from "@/lib/notifications/telegram";
import { dismissChannelFailures } from "@/lib/notifications/failures";
import { createTelegramLinkCode } from "@/lib/notifications/telegram-link";
import { telegramWebhookSecret } from "@/lib/notifications/telegram-webhook";
import type { NotificationMedium } from "@/lib/notifications/queue";
import { isE2ETestMode } from "@/lib/e2e";
import { errorMessage, logAIError } from "@/lib/errors";
import { getAIProvider } from "@/lib/ai";
import { reviewCustomPrompt, type PersonalityTone } from "@/lib/ai/personality";
import {
  AI_COMPACT_THRESHOLD_MAX,
  AI_COMPACT_THRESHOLD_MIN,
  APP_NAME,
  CUSTOM_PROMPT_MAX_LENGTH,
  CUSTOM_PROMPT_REQUIRED_ERROR,
  EMAIL_COLORS,
  TELEGRAM_API_BASE,
  TELEGRAM_LINK_BASE,
} from "@/constants";
import { emailLayout } from "@/lib/email/layout";
import {
  AIKeyEditsSchema,
  aiKeyViews,
  applyAIKeyEdits,
  applyKeyEdit,
  KeyEditSchema,
  keyView,
  savedAIKeysOf,
  storeSavedAIKeys,
  type AIKeyEdits,
  type AIKeyViews,
  type KeyEdit,
  type KeyView,
} from "@/lib/ai/saved-keys";

type UserSettingsUpdate = {
  personalityName: string;
  personalityTone: PersonalityTone;
  personalityEmoji: boolean;
  personalityCustomPrompt: string | null;
  timezone: string;
  aiProvider: "ollama" | "openai" | "anthropic" | "groq" | "gemini" | null;
  aiKeyEdits: AIKeyEdits;
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
  transcriptionKeyEdit: KeyEdit;
  transcriptionModel: string | null;
  emailProvider: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpPass: string | null;
  smtpSecure: boolean;
  smtpFrom: string | null;
  quietHoursFrom: string | null;
  quietHoursTo: string | null;
};

export async function getUserSettingsAction(): Promise<
  ActionResult<{
    settings: typeof userSettings.$inferSelect;
    userEmail: string;
    username: string | null;
    smtpPassSaved: boolean;
    telegramBotConfigured: boolean;
    isAdmin: boolean;
    hosted: boolean;
    aiKeys: AIKeyViews;
    transcriptionKey: KeyView;
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
    username: user?.username ?? null,
    smtpPassSaved: !!settings.smtpPass,
    telegramBotConfigured: !!process.env.TELEGRAM_BOT_TOKEN,
    isAdmin: isAdmin(session.email),
    hosted: isHosted(),
    aiKeys: aiKeyViews(savedAIKeysOf(settings)),
    transcriptionKey: keyView(
      settings.transcriptionApiKey ? decryptValue(settings.transcriptionApiKey) : null
    ),
    // keys and passwords are write-only: once saved they never go back to the browser
    settings: {
      ...settings,
      aiApiKey: null,
      aiSavedKeys: null,
      transcriptionApiKey: null,
      smtpPass: null,
      telegramLinkCodeHash: null,
    },
  };
}

async function customPromptError(
  tone: string,
  prompt: string | null,
  savedPrompt: string | null | undefined
): Promise<string | null> {
  if (!isHosted() || tone !== "custom" || !prompt || prompt === savedPrompt) return null;
  try {
    return await reviewCustomPrompt(getAIProvider(), prompt);
  } catch (err) {
    logAIError(err, "personality-review");
    return null;
  }
}

export async function updateUserSettingsAction(
  data: UserSettingsUpdate
): Promise<ActionResult<{ aiChanged: boolean }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };

  const trimmedName = data.personalityName.trim();
  if (!trimmedName) return { ok: false, error: "Name is required" };
  if (trimmedName.length > 50) return { ok: false, error: "Name too long" };
  const customPrompt = data.personalityCustomPrompt?.trim() || null;
  if (data.personalityTone === "custom" && !customPrompt) {
    return { ok: false, error: CUSTOM_PROMPT_REQUIRED_ERROR };
  }
  if (customPrompt && customPrompt.length > CUSTOM_PROMPT_MAX_LENGTH) {
    return { ok: false, error: "Custom prompt too long" };
  }
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

  const quietError = quietHoursError(data.quietHoursFrom, data.quietHoursTo);
  if (quietError) return { ok: false, error: quietError };

  const keyEdits = AIKeyEditsSchema.safeParse(data.aiKeyEdits);
  const transcriptionKeyEdit = KeyEditSchema.safeParse(data.transcriptionKeyEdit);
  if (!keyEdits.success || !transcriptionKeyEdit.success) {
    return { ok: false, error: "An AI key or model is too long" };
  }

  const saved = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, session.userId),
  });
  const promptError = await customPromptError(
    data.personalityTone,
    customPrompt,
    saved?.personalityCustomPrompt
  );
  if (promptError) return { ok: false, error: promptError };
  const aiKeys = applyAIKeyEdits(saved ? savedAIKeysOf(saved) : {}, keyEdits.data);
  const active = data.aiProvider ? aiKeys[data.aiProvider] : undefined;
  const aiApiKey = active?.apiKey || null;
  const aiModel = active?.model || null;
  const savedTranscriptionKey = saved?.transcriptionApiKey
    ? decryptValue(saved.transcriptionApiKey)
    : null;
  const transcriptionApiKey = applyKeyEdit(savedTranscriptionKey, transcriptionKeyEdit.data);

  const aiChanged =
    saved?.aiProvider !== data.aiProvider ||
    (saved.aiApiKey ? decryptValue(saved.aiApiKey) : null) !== aiApiKey ||
    saved.aiModel !== aiModel ||
    saved.aiOllamaUrl !== (data.aiOllamaUrl || null) ||
    saved.aiUseOwnKey !== data.aiUseOwnKey;

  const addressError = await userServerAddressError(data, saved);
  if (addressError) return { ok: false, error: addressError };

  await db
    .update(userSettings)
    .set({
      ...(aiChanged ? { aiKeyStatus: null, aiKeyError: null, aiKeyCheckedAt: null } : {}),
      personalityName: trimmedName,
      personalityTone: data.personalityTone,
      personalityEmoji: data.personalityEmoji,
      personalityCustomPrompt: customPrompt,
      timezone: data.timezone || "UTC",
      aiProvider: data.aiProvider,
      aiApiKey: aiApiKey && encryptValue(aiApiKey),
      aiModel,
      aiSavedKeys: storeSavedAIKeys(aiKeys),
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
      transcriptionApiKey: transcriptionApiKey && encryptValue(transcriptionApiKey),
      transcriptionModel: data.transcriptionModel || null,
      emailProvider: data.emailProvider || null,
      smtpHost: data.smtpHost || null,
      smtpPort: data.smtpPort || null,
      smtpUser: data.smtpUser || null,
      ...(data.smtpPass ? { smtpPass: encryptValue(data.smtpPass) } : {}),
      smtpSecure: data.smtpSecure,
      smtpFrom: data.smtpFrom || null,
      quietHoursFrom: data.quietHoursFrom,
      quietHoursTo: data.quietHoursTo,
      updatedAt: new Date(),
    })
    .where(eq(userSettings.userId, session.userId));
  await refreshUserReminders(session.userId);
  revalidatePath("/");

  return { ok: true, aiChanged };
}

async function userServerAddressError(
  data: UserSettingsUpdate,
  saved: { ntfyUrl: string | null; smtpHost: string | null; aiOllamaUrl: string | null } | undefined
): Promise<string | null> {
  const hosts: string[] = [];
  if (data.aiOllamaUrl && data.aiOllamaUrl !== saved?.aiOllamaUrl) {
    const url = URL.canParse(data.aiOllamaUrl) ? new URL(data.aiOllamaUrl) : null;
    if (!url || (url.protocol !== "http:" && url.protocol !== "https:")) {
      return "ollama url is not valid";
    }
    hosts.push(url.hostname);
  }
  if (data.ntfyUrl && data.ntfyUrl !== saved?.ntfyUrl) {
    try {
      hosts.push(new URL(data.ntfyUrl).hostname);
    } catch {
      return "ntfy server url is not valid";
    }
  }
  if (data.emailProvider === "smtp" && data.smtpHost && data.smtpHost !== saved?.smtpHost) {
    hosts.push(data.smtpHost);
  }
  try {
    for (const host of hosts) await publicAddress(host);
  } catch (err) {
    return errorMessage(err);
  }
  return null;
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
  webhooks: { id: number; name: string }[];
}> {
  const none = { email: false, ntfy: false, telegram: false, push: false, webhooks: [] };
  const session = await getSession();
  if (!session) return none;

  const settings = await getChannelSettings(session.userId);
  if (!settings) return none;
  const working = workingChannels(settings);
  return {
    email: working.includes("email"),
    ntfy: working.includes("ntfy"),
    telegram: working.includes("telegram"),
    push: working.includes("push"),
    webhooks: settings.webhooks.map(({ id, name }) => ({ id, name })),
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

export async function dismissDeliveryFailuresAction(
  medium: NotificationMedium,
  webhookId: number | null = null
): Promise<void> {
  const session = await getSession();
  if (!session || !ALL_CHANNELS.includes(medium)) return;
  await dismissChannelFailures(session.userId, medium, webhookId);
  revalidatePath("/");
}

function quietHoursError(from: string | null, to: string | null): string | null {
  if (from === null && to === null) return null;
  if (from === null || to === null || parseClock(from) === null || parseClock(to) === null) {
    return "quiet hours need a start and an end time";
  }
  if (parseClock(from) === parseClock(to)) return "start and end can't be the same time";
  return null;
}

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import type { NotificationMedium } from "./queue";

export type ChannelSettings = Pick<
  typeof userSettings.$inferSelect,
  | "notificationsEmail"
  | "emailProvider"
  | "smtpHost"
  | "notificationsPush"
  | "ntfyUrl"
  | "ntfyTopic"
  | "notificationsTelegram"
  | "telegramChatId"
>;

export function workingChannels(settings: ChannelSettings): NotificationMedium[] {
  const emailConfigured =
    !!process.env.RESEND_API_KEY ||
    !!process.env.SMTP_HOST ||
    (settings.emailProvider === "smtp" && !!settings.smtpHost);

  const channels: NotificationMedium[] = [];
  if (settings.notificationsEmail && emailConfigured) channels.push("email");
  if (settings.notificationsPush && settings.ntfyUrl && settings.ntfyTopic) channels.push("ntfy");
  if (settings.notificationsTelegram && settings.telegramChatId && process.env.TELEGRAM_BOT_TOKEN) {
    channels.push("telegram");
  }
  return channels;
}

export async function getWorkingChannels(userId: number): Promise<NotificationMedium[]> {
  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
  });
  return settings ? workingChannels(settings) : [];
}

export const ALL_CHANNELS: NotificationMedium[] = ["email", "telegram", "ntfy"];

export type ChannelDecision = {
  medium: NotificationMedium;
  state: "send" | "notSelected" | "notSetUp";
};

export function channelDecisions(
  bucketChannels: readonly string[],
  settings: ChannelSettings | undefined
): ChannelDecision[] {
  const working = settings ? workingChannels(settings) : [];
  return ALL_CHANNELS.map((medium) => ({
    medium,
    state: !bucketChannels.includes(medium)
      ? "notSelected"
      : working.includes(medium)
        ? "send"
        : "notSetUp",
  }));
}

export async function withDefaultChannels(
  userId: number,
  notifications: unknown
): Promise<Record<string, unknown>> {
  const rules =
    notifications && typeof notifications === "object"
      ? (notifications as Record<string, unknown>)
      : {};
  if (Array.isArray(rules.medium) && rules.medium.length > 0) return rules;
  return { ...rules, medium: await getWorkingChannels(userId) };
}

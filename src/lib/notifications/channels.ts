import { eq, getTableColumns, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { pushSubscriptions, userSettings } from "@/lib/db/schema";
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
> & { hasPushDevice: boolean };

export const hasPushDevice =
  sql<boolean>`exists (select 1 from ${pushSubscriptions} where ${pushSubscriptions.userId} = ${userSettings.userId})`.mapWith(
    Boolean
  );

export async function getChannelSettings(userId: number) {
  const [row] = await db
    .select({ ...getTableColumns(userSettings), hasPushDevice })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  return row;
}

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
  if (settings.hasPushDevice) channels.push("push");
  return channels;
}

export async function getWorkingChannels(userId: number): Promise<NotificationMedium[]> {
  const settings = await getChannelSettings(userId);
  return settings ? workingChannels(settings) : [];
}

export const ALL_CHANNELS: NotificationMedium[] = ["email", "push", "telegram", "ntfy"];

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

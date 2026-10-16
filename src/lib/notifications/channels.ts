import { and, eq, getTableColumns, getTableName, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bucketMembers, outgoingWebhooks, pushSubscriptions, userSettings } from "@/lib/db/schema";
import { memberChannels } from "@/lib/rules";
import { MemberChannels } from "@/types/rules";
import type { NotificationMedium } from "./queue";

export type UserWebhook = { id: number; name: string; isDefault: boolean };

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
> & { hasPushDevice: boolean; webhooks: UserWebhook[] };

// drizzle writes columns without their table in single-table selects, so inside a subquery
// ${userSettings.userId} would read the subquery's own user_id and match every user's rows
const settingsUserId = sql`${sql.identifier(getTableName(userSettings))}.${sql.identifier(userSettings.userId.name)}`;

export const hasPushDevice =
  sql<boolean>`exists (select 1 from ${pushSubscriptions} where ${pushSubscriptions.userId} = ${settingsUserId})`.mapWith(
    Boolean
  );

export const userWebhooks = sql<
  UserWebhook[]
>`(select json_group_array(json_object('id', id, 'name', name, 'isDefault', is_default)) from (select id, name, is_default from ${outgoingWebhooks} where user_id = ${settingsUserId} order by id))`.mapWith(
  (raw: string) =>
    (JSON.parse(raw) as { id: number; name: string; isDefault: number }[]).map((w) => ({
      ...w,
      isDefault: w.isDefault === 1,
    }))
);

export async function getChannelSettings(userId: number) {
  const [row] = await db
    .select({ ...getTableColumns(userSettings), hasPushDevice, webhooks: userWebhooks })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  return row;
}

export async function getMemberChannels(userId: number, bucketId: number): Promise<MemberChannels> {
  const row = await db.query.bucketMembers.findFirst({
    columns: { channels: true },
    where: and(eq(bucketMembers.bucketId, bucketId), eq(bucketMembers.userId, userId)),
  });
  return memberChannels(row?.channels);
}

// built-in channels only: webhooks are picked one by one, see channelDecisions
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

export const BUILT_IN_CHANNELS: NotificationMedium[] = ["email", "push", "telegram", "ntfy"];
export const ALL_CHANNELS: NotificationMedium[] = [...BUILT_IN_CHANNELS, "webhook"];

export type ChannelDecision = {
  medium: NotificationMedium;
  webhookId: number | null;
  label: string;
  state: "send" | "notSelected" | "notSetUp";
};

export function channelDecisions(
  selected: MemberChannels,
  settings: ChannelSettings | undefined
): ChannelDecision[] {
  const working = settings ? workingChannels(settings) : [];
  const builtIn = BUILT_IN_CHANNELS.map((medium): ChannelDecision => ({
    medium,
    webhookId: null,
    label: medium,
    state: !(selected.medium as readonly NotificationMedium[]).includes(medium)
      ? "notSelected"
      : working.includes(medium)
        ? "send"
        : "notSetUp",
  }));
  const webhooks = (settings?.webhooks ?? []).map((webhook): ChannelDecision => ({
    medium: "webhook",
    webhookId: webhook.id,
    label: webhook.name,
    state: selected.webhooks.includes(webhook.id) ? "send" : "notSelected",
  }));
  return [...builtIn, ...webhooks];
}

// A new bucket's rules hold no channels: the template's go to its owner, or else every channel they
// have working, plus the webhooks they turned on for new buckets
export async function startingChannels(
  userId: number,
  notifications: unknown
): Promise<{ rules: Record<string, unknown>; channels: MemberChannels }> {
  const { medium, webhooks, ...rules } =
    notifications && typeof notifications === "object"
      ? (notifications as Record<string, unknown>)
      : {};
  const settings = await getChannelSettings(userId);
  const picked = MemberChannels.safeParse({
    medium:
      Array.isArray(medium) && medium.length > 0
        ? medium
        : settings
          ? workingChannels(settings)
          : [],
    webhooks: Array.isArray(webhooks)
      ? webhooks
      : (settings?.webhooks ?? []).filter((w) => w.isDefault).map((w) => w.id),
  });
  return { rules, channels: picked.success ? picked.data : MemberChannels.parse({}) };
}

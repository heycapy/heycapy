import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bucketMembers, buckets, userSettings } from "@/lib/db/schema";
import { defaultValues, followedRules, parseNotificationDefaults } from "@/lib/buckets/follow";
import { memberChannels, parseNotificationRules } from "@/lib/rules";
import { refreshUserReminders } from "@/lib/reminders/refresh";
import { MemberChannels, type BucketSchema, type NotificationDefaults } from "@/types/rules";
import { getChannelSettings, workingChannels } from "./channels";

export function parseObject(raw: unknown): Record<string, unknown> {
  try {
    const value: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function getNotificationDefaults(userId: number): Promise<NotificationDefaults> {
  const row = await db.query.userSettings.findFirst({
    columns: { notificationDefaults: true },
    where: eq(userSettings.userId, userId),
  });
  return parseNotificationDefaults(row?.notificationDefaults);
}

// Channels not picked in tweaks yet are every channel set up right now, plus the webhooks
// that are on by default
export async function defaultChannels(
  userId: number,
  defaults: NotificationDefaults
): Promise<MemberChannels> {
  const settings = await getChannelSettings(userId);
  return {
    medium:
      defaults.medium ??
      MemberChannels.shape.medium.parse(settings ? workingChannels(settings) : []),
    webhooks: (settings?.webhooks ?? []).filter((w) => w.isDefault).map((w) => w.id),
    followsTweaks: true,
  };
}

// Copies the person's defaults into every setting that follows them: the rules of the buckets
// they own and their own channels in every bucket they're in
export async function applyNotificationDefaults(userId: number): Promise<void> {
  const defaults = await getNotificationDefaults(userId);
  const values = defaultValues(defaults);
  const channels = await defaultChannels(userId, defaults);

  const owned = await db
    .select({
      id: buckets.id,
      notificationsRules: buckets.notificationsRules,
      fieldSchema: buckets.fieldSchema,
    })
    .from(buckets)
    .where(eq(buckets.userId, userId));
  const memberships = await db
    .select({ bucketId: bucketMembers.bucketId, channels: bucketMembers.channels })
    .from(bucketMembers)
    .where(eq(bucketMembers.userId, userId));

  db.transaction((tx) => {
    for (const bucket of owned) {
      const follows = parseNotificationRules(bucket.notificationsRules).followsTweaks;
      if (follows.length === 0) continue;
      const followed = followedRules(follows, values);
      tx.update(buckets)
        .set({
          notificationsRules: JSON.stringify({
            ...parseObject(bucket.notificationsRules),
            ...followed.notifications,
          }),
          // capy keeps any item values in a bucket without a field schema, so "off" doesn't add one
          ...((bucket.fieldSchema || followed.overdue.notifyWhenOverdue) && {
            fieldSchema: JSON.stringify({
              ...parseObject(bucket.fieldSchema),
              ...followed.overdue,
            }) as unknown as BucketSchema,
          }),
        })
        .where(eq(buckets.id, bucket.id))
        .run();
    }
    for (const row of memberships) {
      if (!memberChannels(row.channels).followsTweaks) continue;
      tx.update(bucketMembers)
        .set({ channels: JSON.stringify(channels) })
        .where(and(eq(bucketMembers.bucketId, row.bucketId), eq(bucketMembers.userId, userId)))
        .run();
    }
  });
  await refreshUserReminders(userId);
}

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bucketMembers, buckets, outgoingWebhooks } from "@/lib/db/schema";
import { findBucketByName } from "@/lib/db/buckets";
import { refreshBucketReminders } from "@/lib/reminders/refresh";
import { parseClock } from "@/lib/reminders/zoned";
import { QUICK_REMIND_VALUES } from "@/lib/notifications/constants";
import { BUCKET_NAME_MAX_LENGTH, DUPLICATE_BUCKET_NAME_ERROR } from "@/constants";
import { getMemberChannels } from "@/lib/notifications/channels";
import { defaultChannels, getNotificationDefaults } from "@/lib/notifications/defaults";
import { parseNotificationRules } from "@/lib/rules";
import {
  BucketSchema,
  FOLLOWABLE_SETTINGS,
  ItemsRules,
  MemberChannels,
  NotificationRules,
  ReminderOffsets,
} from "@/types/rules";
import { bucketValues, defaultValues, followedRules, keepFollowing, sameChannels } from "./follow";
import type { ActionResult } from "@/types/result";
import { SETTING_LABELS } from "./constants";

const itemsShape = ItemsRules.shape;
const notificationsShape = NotificationRules.shape;
const channelsShape = MemberChannels.shape;

// followsTweaks left out: it keeps following unless the channels changed
export const MemberChannelsInput = z.object({
  medium: channelsShape.medium.unwrap(),
  webhooks: channelsShape.webhooks.unwrap(),
  followsTweaks: channelsShape.followsTweaks,
});

// The rules' own checks without their defaults, so a rule left out isn't overwritten by one
export const BucketSettingsInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(BUCKET_NAME_MAX_LENGTH, "Name too long"),
  itemsRules: z.object({
    sortBy: itemsShape.sortBy.unwrap().optional(),
    drag: itemsShape.drag.unwrap().optional(),
    readonly: itemsShape.readonly.unwrap().optional(),
    showCompleted: itemsShape.showCompleted.unwrap().optional(),
    defaultDeadlineOffsetDays: itemsShape.defaultDeadlineOffsetDays.unwrap().optional(),
    recurrenceMode: itemsShape.recurrenceMode.unwrap().optional(),
  }),
  notificationsRules: z.object({
    // Unknown ones (from older versions) are dropped rather than failing the whole save
    reminderButtons: z
      .array(z.string())
      .transform((picked) => QUICK_REMIND_VALUES.filter((v) => picked.includes(v)))
      .optional(),
    notifyAt: z
      .string()
      .refine((value) => parseClock(value) !== null)
      .optional(),
    defaultReminders: ReminderOffsets.optional(),
    repeat: notificationsShape.repeat.unwrap().optional(),
  }),
  notificationTriggers: BucketSchema.pick({
    notifyOnArrival: true,
    notifyWhenOverdue: true,
    overdueRepeatHours: true,
    overdueFirstAlertMins: true,
  }).optional(),
  // The saver's own channels for the bucket
  channels: MemberChannelsInput.optional(),
  // Left out (capy), a setting keeps following tweaks unless this save changes it
  followsTweaks: z.array(z.enum(FOLLOWABLE_SETTINGS)).optional(),
});

export type BucketSettingsInput = z.input<typeof BucketSettingsInput>;
export type MemberChannelsInput = z.input<typeof MemberChannelsInput>;

function settingsError(issue: z.core.$ZodIssue | undefined): string {
  if (!issue) return "Invalid settings";
  const [group, key] = issue.path;
  if (group === "name") return issue.message;
  const label = typeof key === "string" ? SETTING_LABELS[key] : undefined;
  return label ? `Invalid ${label}` : "Invalid settings";
}

function parseStored(raw: unknown): Record<string, unknown> {
  try {
    const value: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function ownWebhookIds(userId: number): Promise<number[]> {
  const rows = await db
    .select({ id: outgoingWebhooks.id })
    .from(outgoingWebhooks)
    .where(eq(outgoingWebhooks.userId, userId));
  return rows.map((w) => w.id);
}

// Channels that follow tweaks are the person's defaults, whatever was sent
async function channelsToSave(
  userId: number,
  bucketId: number,
  input: z.output<typeof MemberChannelsInput>
): Promise<MemberChannels> {
  const stored = await getMemberChannels(userId, bucketId);
  const follows = input.followsTweaks ?? (!!stored.followsTweaks && sameChannels(stored, input));
  if (!follows) return { ...input, followsTweaks: false };
  return defaultChannels(userId, await getNotificationDefaults(userId));
}

// ids of deleted or someone else's webhooks are dropped. False when they aren't a member
function writeChannels(
  tx: Tx,
  userId: number,
  bucketId: number,
  channels: MemberChannels,
  webhookIds: number[]
): boolean {
  const { changes } = tx
    .update(bucketMembers)
    .set({
      channels: JSON.stringify({
        medium: channels.medium,
        webhooks: channels.webhooks.filter((id) => webhookIds.includes(id)),
        followsTweaks: channels.followsTweaks,
      }),
    })
    .where(and(eq(bucketMembers.bucketId, bucketId), eq(bucketMembers.userId, userId)))
    .run();
  return changes > 0;
}

// Saves what the settings dialog shows. Quiet hours and the bucket's fields aren't in it and are kept
export async function saveBucketSettings(
  userId: number,
  bucketId: number,
  input: BucketSettingsInput
): Promise<ActionResult> {
  const parsed = BucketSettingsInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: settingsError(parsed.error.issues[0]) };
  }
  const { name, itemsRules, notificationsRules, notificationTriggers, channels, followsTweaks } =
    parsed.data;

  const bucket = await db.query.buckets.findFirst({
    where: (b, { eq: qeq, and: qand }) => qand(qeq(b.id, bucketId), qeq(b.userId, userId)),
  });
  if (!bucket) return { ok: false, error: "Bucket not found" };
  if (await findBucketByName(userId, name, bucketId)) {
    return { ok: false, error: DUPLICATE_BUCKET_NAME_ERROR };
  }

  const storedRules = parseStored(bucket.notificationsRules);
  const storedSchema = parseStored(bucket.fieldSchema);
  const triggers = notificationTriggers && {
    notifyOnArrival: notificationTriggers.notifyOnArrival ?? false,
    notifyWhenOverdue: notificationTriggers.notifyWhenOverdue ?? false,
    overdueRepeatHours: notificationTriggers.notifyWhenOverdue
      ? notificationTriggers.overdueRepeatHours
      : undefined,
    overdueFirstAlertMins: notificationTriggers.notifyWhenOverdue
      ? notificationTriggers.overdueFirstAlertMins
      : undefined,
  };
  const rules = { ...storedRules, ...notificationsRules, notifyAt: notificationsRules.notifyAt };
  const schema = { ...storedSchema, ...triggers };
  const follows =
    followsTweaks ??
    keepFollowing(
      parseNotificationRules(bucket.notificationsRules).followsTweaks,
      bucketValues(storedRules, storedSchema),
      bucketValues(rules, schema)
    );
  const followed = followedRules(follows, defaultValues(await getNotificationDefaults(userId)));
  // capy keeps any item values in a bucket without a field schema, so "off" doesn't add one
  const writeSchema =
    !!triggers ||
    (follows.includes("overdue") && (!!bucket.fieldSchema || !!followed.overdue.notifyWhenOverdue));
  const webhookIds = channels ? await ownWebhookIds(userId) : [];
  const myChannels = channels && (await channelsToSave(userId, bucketId, channels));

  db.transaction((tx) => {
    tx.update(buckets)
      .set({
        name,
        itemsRules: JSON.stringify(itemsRules),
        notificationsRules: JSON.stringify({
          ...rules,
          ...followed.notifications,
          followsTweaks: follows,
        }),
        ...(writeSchema && {
          fieldSchema: JSON.stringify({
            ...schema,
            ...followed.overdue,
          }) as unknown as BucketSchema,
        }),
        updatedAt: new Date(),
      })
      .where(and(eq(buckets.id, bucketId), eq(buckets.userId, userId)))
      .run();
    if (myChannels) writeChannels(tx, userId, bucketId, myChannels, webhookIds);
  });
  await refreshBucketReminders(bucketId);

  revalidatePath("/");
  return { ok: true };
}

// Any member, the owner included, picks where their own reminders for the bucket go
export async function saveMemberChannels(
  userId: number,
  bucketId: number,
  input: MemberChannelsInput
): Promise<ActionResult> {
  const parsed = MemberChannelsInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid channels" };

  const webhookIds = await ownWebhookIds(userId);
  const channels = await channelsToSave(userId, bucketId, parsed.data);
  const saved = db.transaction((tx) => writeChannels(tx, userId, bucketId, channels, webhookIds));
  if (!saved) return { ok: false, error: "Bucket not found" };
  await refreshBucketReminders(bucketId);

  revalidatePath("/");
  return { ok: true };
}

import { db } from "@/lib/db";
import { parseItemsRules } from "@/lib/rules";
import {
  getChannelSettings,
  workingChannels,
  type UserWebhook,
} from "@/lib/notifications/channels";
import { QUICK_REMIND_VALUES } from "@/lib/notifications/constants";
import { MAX_REMINDER_OFFSET_MINS, MAX_REMINDERS_PER_ITEM } from "@/lib/reminders/constants";
import { saveBucketSettings, type BucketSettingsInput } from "@/lib/buckets/settings";
import { parseBucketSettings } from "@/components/buckets/parseBucketSettings";
import { MEDIUM_OPTIONS, RECURRENCE_MODE_OPTIONS } from "@/components/buckets/constants";
import type { buckets } from "@/lib/db/schema";
import type { Tool } from "./types";

type BucketRow = typeof buckets.$inferSelect;

const SETTING_PROPERTIES = {
  sort_by: {
    type: "string",
    enum: ["deadline", "created_at", "manual"],
    description: "How items are ordered in this bucket.",
  },
  allow_drag: {
    type: "boolean",
    description: "With sort_by manual: lets the user drag items to reorder them.",
  },
  show_completed: {
    type: "boolean",
    description: "Keep completed items visible in the list.",
  },
  repeating_items: {
    type: "string",
    enum: RECURRENCE_MODE_OPTIONS.map((o) => o.value),
    description:
      "How a repeating item's next date comes about: " +
      RECURRENCE_MODE_OPTIONS.map((o) => `${o.value} (${o.label}) = ${o.hint}`).join("; ") +
      ".",
  },
  read_only: {
    type: "boolean",
    description:
      "Prevents adding or editing items in this bucket, for the user and for you. Confirm before turning it on.",
  },
  default_deadline_offset_days: {
    type: ["integer", "null"],
    minimum: 0,
    description: "New items get a deadline this many days from today; null for none.",
  },
  channels: {
    type: "array",
    items: { type: "string", enum: MEDIUM_OPTIONS.map((o) => o.value) },
    description:
      "The full list of channels this bucket's notifications go to ([] for none). " +
      "Only channels in working_channels actually deliver; the others need setting up in tweaks first. " +
      "Confirm before removing one.",
  },
  reminder_buttons: {
    type: "array",
    items: { type: "string", enum: [...QUICK_REMIND_VALUES] },
    description:
      "'Remind again' buttons next to done on each reminder: 15 / 30 / 60 minutes, or tomorrow. " +
      "Push shows the first one, ntfy two, email and telegram all.",
  },
  default_reminders_mins: {
    type: "array",
    items: { type: "integer", minimum: 0, maximum: MAX_REMINDER_OFFSET_MINS },
    maxItems: MAX_REMINDERS_PER_ITEM,
    description:
      "Reminders new items start with, as minutes before the deadline (0 = at the deadline, " +
      "1440 = a day before). Items whose reminders were changed keep their own.",
  },
  remind_at: {
    type: ["string", "null"],
    description:
      "Time of day ('HH:MM', 24-hour) for items without a time; the bucket also never reminds earlier " +
      "than it. null for none.",
  },
  deadline_repeat: {
    type: "string",
    enum: ["once", "daily"],
    description: "daily = re-send the deadline reminder every day until the item is completed.",
  },
  notify_on_arrival: {
    type: "boolean",
    description: "Notify every time a new item arrives through the bucket's webhook.",
  },
  notify_when_overdue: {
    type: "boolean",
    description: "Notify when an item passes its deadline without being completed.",
  },
  overdue_first_alert_mins: {
    type: ["integer", "null"],
    minimum: 1,
    description: "With notify_when_overdue: minutes after the deadline for the first alert.",
  },
  overdue_repeat_hours: {
    type: ["number", "null"],
    exclusiveMinimum: 0,
    description:
      "With notify_when_overdue: repeat the alert every this many hours (0.25 = 15 min); null = once.",
  },
};

export const BUCKET_SETTINGS_TOOLS: Tool[] = [
  {
    name: "get_bucket_settings",
    description:
      "Read every setting of one bucket, plus which notification channels actually work for the user. " +
      "Call it before changing settings, when the user asks how a bucket is set up, or before promising " +
      "a notification will arrive. webhooks_on lists the user's webhooks (discord, slack, their own server) " +
      "this bucket also sends to; you can't change those, the user turns them on in bucket settings → notifications.",
    parameters: {
      type: "object",
      properties: { bucket_id: { type: "number", description: "The bucket's ID." } },
      required: ["bucket_id"],
    },
  },
  {
    name: "update_bucket_settings",
    description:
      "Change a bucket's settings. Only include the settings to change; the rest stay as they are. " +
      "Returns the bucket's settings after the change.",
    parameters: {
      type: "object",
      properties: {
        bucket_id: { type: "number", description: "The bucket's ID." },
        ...SETTING_PROPERTIES,
      },
      required: ["bucket_id"],
    },
  },
];

type UserChannels = { working: string[]; webhooks: UserWebhook[] };

async function userChannels(userId: number): Promise<UserChannels> {
  const settings = await getChannelSettings(userId);
  return settings
    ? { working: workingChannels(settings), webhooks: settings.webhooks }
    : { working: [], webhooks: [] };
}

function describeSettings(bucket: BucketRow, { working, webhooks }: UserChannels) {
  const s = parseBucketSettings(bucket);
  return {
    bucket_id: bucket.id,
    name: s.name,
    sort_by: s.sortBy,
    allow_drag: s.drag,
    show_completed: s.showCompleted,
    repeating_items: s.recurrenceMode,
    read_only: s.readonly,
    default_deadline_offset_days:
      parseItemsRules(bucket.itemsRules).defaultDeadlineOffsetDays ?? null,
    channels: s.mediums,
    channels_not_working: s.mediums.filter((m) => !working.includes(m)),
    working_channels: working,
    // read only for capy: the user turns webhooks on in bucket settings
    webhooks_on: webhooks.filter((w) => s.webhooks.includes(w.id)).map((w) => w.name),
    reminder_buttons: s.reminderButtons,
    default_reminders_mins: s.defaultReminders,
    remind_at: s.notifyAt || null,
    deadline_repeat: s.repeat,
    notify_on_arrival: s.notifyOnArrival,
    notify_when_overdue: s.notifyWhenOverdue,
    overdue_first_alert_mins: s.overdueFirstAlertMins ?? null,
    overdue_repeat_hours: s.overdueRepeatHours ?? null,
  };
}

async function findBucket(userId: number, bucketId: number): Promise<BucketRow | undefined> {
  return db.query.buckets.findFirst({
    where: (b, { eq, and, isNull }) =>
      and(eq(b.id, bucketId), eq(b.userId, userId), isNull(b.deletedAt)),
  });
}

function pick(args: Record<string, unknown>, key: string, current: unknown): unknown {
  return key in args && args[key] !== undefined ? args[key] : current;
}

export async function executeBucketSettingsTool(
  name: string,
  args: Record<string, unknown>,
  userId: number
): Promise<string | null> {
  if (name !== "get_bucket_settings" && name !== "update_bucket_settings") return null;

  const bucketId = Number(args.bucket_id);
  const bucket = await findBucket(userId, bucketId);
  if (!bucket) return JSON.stringify({ ok: false, error: "Bucket not found" });

  if (name === "get_bucket_settings") {
    return JSON.stringify({
      ok: true,
      settings: describeSettings(bucket, await userChannels(userId)),
    });
  }

  const current = describeSettings(bucket, { working: [], webhooks: [] });
  const remindAt = pick(args, "remind_at", current.remind_at);
  // Checked by saveBucketSettings, the same checks the settings dialog goes through
  const input = {
    name: current.name,
    itemsRules: {
      sortBy: pick(args, "sort_by", current.sort_by),
      drag: pick(args, "allow_drag", current.allow_drag),
      readonly: pick(args, "read_only", current.read_only),
      showCompleted: pick(args, "show_completed", current.show_completed),
      recurrenceMode: pick(args, "repeating_items", current.repeating_items),
      defaultDeadlineOffsetDays: pick(
        args,
        "default_deadline_offset_days",
        current.default_deadline_offset_days
      ),
    },
    notificationsRules: {
      medium: pick(args, "channels", current.channels),
      reminderButtons: pick(args, "reminder_buttons", current.reminder_buttons),
      notifyAt: remindAt === null || remindAt === "" ? undefined : remindAt,
      defaultReminders: pick(args, "default_reminders_mins", current.default_reminders_mins),
      repeat: pick(args, "deadline_repeat", current.deadline_repeat),
    },
    notificationTriggers: {
      notifyOnArrival: pick(args, "notify_on_arrival", current.notify_on_arrival),
      notifyWhenOverdue: pick(args, "notify_when_overdue", current.notify_when_overdue),
      overdueFirstAlertMins:
        pick(args, "overdue_first_alert_mins", current.overdue_first_alert_mins) ?? undefined,
      overdueRepeatHours:
        pick(args, "overdue_repeat_hours", current.overdue_repeat_hours) ?? undefined,
    },
  } as BucketSettingsInput;

  const result = await saveBucketSettings(userId, bucketId, input);
  if (!result.ok) return JSON.stringify(result);

  const saved = await findBucket(userId, bucketId);
  return JSON.stringify({
    ok: true,
    settings: saved && describeSettings(saved, await userChannels(userId)),
  });
}

import { OVERDUE_FIRST_ALERT_DEFAULT_MINS } from "@/lib/reminders/constants";
import {
  NotificationDefaults,
  NotificationRules,
  type FollowableSetting,
  type MemberChannels,
} from "@/types/rules";

export type OverdueSettings = {
  notifyWhenOverdue: boolean;
  overdueFirstAlertMins?: number;
  overdueRepeatHours?: number;
};

export type FollowableValues = {
  defaultReminders: number[];
  notifyAt: string;
  repeat: NotificationRules["repeat"];
  overdue: OverdueSettings;
};

export function parseNotificationDefaults(raw: string | null | undefined): NotificationDefaults {
  try {
    const parsed = NotificationDefaults.safeParse(raw ? JSON.parse(raw) : {});
    return parsed.success ? parsed.data : NotificationDefaults.parse({});
  } catch {
    return NotificationDefaults.parse({});
  }
}

export function overdueOf(
  source: Partial<Record<keyof OverdueSettings, unknown>>
): OverdueSettings {
  if (source.notifyWhenOverdue !== true) return { notifyWhenOverdue: false };
  return {
    notifyWhenOverdue: true,
    overdueFirstAlertMins:
      typeof source.overdueFirstAlertMins === "number" ? source.overdueFirstAlertMins : undefined,
    overdueRepeatHours:
      typeof source.overdueRepeatHours === "number" ? source.overdueRepeatHours : undefined,
  };
}

export function defaultValues(defaults: NotificationDefaults): FollowableValues {
  return {
    defaultReminders: defaults.defaultReminders,
    notifyAt: defaults.notifyAt,
    repeat: defaults.repeat,
    overdue: overdueOf(defaults),
  };
}

// A bucket's stored notification rules and field schema, as plain objects
export function bucketValues(
  rules: Record<string, unknown>,
  fieldSchema: Record<string, unknown>
): FollowableValues {
  const parsed = NotificationRules.safeParse(rules);
  const notifications = parsed.success ? parsed.data : NotificationRules.parse({});
  return {
    defaultReminders: notifications.defaultReminders,
    notifyAt: notifications.notifyAt,
    repeat: notifications.repeat,
    overdue: overdueOf(fieldSchema),
  };
}

function sameList<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((v) => b.includes(v));
}

export function sameSetting(key: FollowableSetting, a: FollowableValues, b: FollowableValues) {
  switch (key) {
    case "defaultReminders":
      return sameList(a.defaultReminders, b.defaultReminders);
    case "overdue":
      return (
        a.overdue.notifyWhenOverdue === b.overdue.notifyWhenOverdue &&
        (a.overdue.overdueFirstAlertMins ?? OVERDUE_FIRST_ALERT_DEFAULT_MINS) ===
          (b.overdue.overdueFirstAlertMins ?? OVERDUE_FIRST_ALERT_DEFAULT_MINS) &&
        a.overdue.overdueRepeatHours === b.overdue.overdueRepeatHours
      );
    default:
      return a[key] === b[key];
  }
}

// A setting changed in the bucket itself (by capy, or anything that doesn't say) stops following
export function keepFollowing(
  follows: readonly FollowableSetting[],
  before: FollowableValues,
  after: FollowableValues
): FollowableSetting[] {
  return follows.filter((key) => sameSetting(key, before, after));
}

export function sameChannels(a: MemberChannels, b: MemberChannels): boolean {
  return sameList(a.medium, b.medium) && sameList(a.webhooks, b.webhooks);
}

// The values a bucket stores for the settings that follow tweaks
export function followedRules(
  follows: readonly FollowableSetting[],
  values: FollowableValues
): { notifications: Partial<FollowableValues>; overdue: Partial<OverdueSettings> } {
  return {
    notifications: {
      ...(follows.includes("defaultReminders") && { defaultReminders: values.defaultReminders }),
      ...(follows.includes("notifyAt") && { notifyAt: values.notifyAt }),
      ...(follows.includes("repeat") && { repeat: values.repeat }),
    },
    // overdueOf leaves the two times out when it's off, and they must be cleared, not kept
    overdue: follows.includes("overdue")
      ? {
          overdueFirstAlertMins: undefined,
          overdueRepeatHours: undefined,
          ...values.overdue,
        }
      : {},
  };
}

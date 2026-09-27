import type { NotificationRules } from "@/types/rules";
import { ON_HOLD_STATUS } from "@/constants";
import { OVERDUE_FIRST_ALERT_DEFAULT_MINS } from "./constants";
import { atLocalClock, addLocalDays, minutesOfDay, parseClock, toLocal } from "./zoned";

export type ReminderInputs = {
  deadline: Date | null;
  status: string;
  deletedAt: Date | null;
  remindNotBefore: Date | null;
  notifiedAt: Date | null;
  overdueNotifiedAt: Date | null;
  notificationOffsetMins: number | null;
  rules: NotificationRules;
  notifyWhenOverdue: boolean;
  overdueRepeatHours: number | undefined;
  overdueFirstAlertMins?: number;
  timezone: string;
};

function canRemind(i: ReminderInputs): i is ReminderInputs & { deadline: Date } {
  return (
    i.deadline !== null &&
    i.deletedAt === null &&
    i.status !== "completed" &&
    i.status !== ON_HOLD_STATUS
  );
}

function notBefore(date: Date, floor: Date | null): Date {
  return floor && floor > date ? floor : date;
}

// Applies "notify at" and quiet hours
function applyDeliveryWindow(date: Date, rules: NotificationRules, timezone: string): Date {
  const notifyAt = rules.notifyAt ? parseClock(rules.notifyAt) : null;
  const quietFrom = rules.quietHours ? parseClock(rules.quietHours.from) : null;
  const quietTo = rules.quietHours ? parseClock(rules.quietHours.to) : null;

  let result = date;
  // Converges within a few passes
  for (let pass = 0; pass < 3; pass++) {
    const start = result.getTime();
    if (notifyAt !== null && minutesOfDay(toLocal(result, timezone)) < notifyAt) {
      result = atLocalClock(result, notifyAt, timezone);
    }
    if (quietFrom !== null && quietTo !== null && quietFrom !== quietTo) {
      const mins = minutesOfDay(toLocal(result, timezone));
      const overnight = quietFrom > quietTo;
      if (overnight && mins >= quietFrom) result = atLocalClock(result, quietTo, timezone, 1);
      else if (overnight && mins < quietTo) result = atLocalClock(result, quietTo, timezone);
      else if (!overnight && mins >= quietFrom && mins < quietTo) {
        result = atLocalClock(result, quietTo, timezone);
      }
    }
    if (result.getTime() === start) break;
  }
  return result;
}

export function nextDeadlineReminder(i: ReminderInputs): Date | null {
  if (!canRemind(i) || i.rules.medium.length === 0) return null;

  let due: Date;
  if (!i.notifiedAt) {
    const offsetMins = i.notificationOffsetMins ?? i.rules.defaultOffsetMins;
    due = new Date(i.deadline.getTime() - offsetMins * 60_000);
  } else if (i.rules.repeat === "daily") {
    due = addLocalDays(i.notifiedAt, 1, i.timezone);
  } else {
    return null;
  }

  return applyDeliveryWindow(notBefore(due, i.remindNotBefore), i.rules, i.timezone);
}

export function nextOverdueAlert(i: ReminderInputs): Date | null {
  if (!canRemind(i) || !i.notifyWhenOverdue || i.rules.medium.length === 0) return null;

  let due: Date;
  if (!i.overdueNotifiedAt) {
    const delayMins = i.overdueFirstAlertMins ?? OVERDUE_FIRST_ALERT_DEFAULT_MINS;
    due = new Date(i.deadline.getTime() + delayMins * 60_000);
  } else if (i.overdueRepeatHours) {
    due = new Date(i.overdueNotifiedAt.getTime() + i.overdueRepeatHours * 3_600_000);
  } else {
    return null;
  }

  return notBefore(due, i.remindNotBefore);
}

export function remindAgainAt(
  i: ReminderInputs,
  at: Date,
  now: Date
): { remindNotBefore: Date; notifiedAt?: Date | null; overdueNotifiedAt?: null } {
  const firstAlertMs = (i.overdueFirstAlertMins ?? OVERDUE_FIRST_ALERT_DEFAULT_MINS) * 60_000;
  const overdueByThen =
    i.notifyWhenOverdue &&
    i.deadline !== null &&
    i.deadline.getTime() + firstAlertMs <= at.getTime();
  return overdueByThen
    ? { remindNotBefore: at, overdueNotifiedAt: null, notifiedAt: i.notifiedAt ?? now }
    : { remindNotBefore: at, notifiedAt: null };
}

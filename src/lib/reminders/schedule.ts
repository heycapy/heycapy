import { ITEM_STATUS, isClosedStatus } from "@/constants";
import type { NotificationRules } from "@/types/rules";
import {
  ALL_DAY_REMINDER_MINS,
  MAX_DELIVERY_WINDOW_JUMPS,
  OVERDUE_FIRST_ALERT_DEFAULT_MINS,
} from "./constants";
import {
  addLocalDays,
  atLocalClock,
  isAllDay,
  minutesOfDay,
  overdueFrom,
  parseClock,
  toLocal,
} from "./zoned";

export type ReminderInputs = {
  deadline: Date | null;
  status: string;
  deletedAt: Date | null;
  remindNotBefore: Date | null;
  notifiedAt: Date | null;
  overdueNotifiedAt: Date | null;
  reminderOffsets: number[] | null;
  rules: NotificationRules;
  notifyWhenOverdue: boolean;
  overdueRepeatHours: number | undefined;
  overdueFirstAlertMins?: number;
  timezone: string;
  userQuietHours?: QuietHours | null;
};

export type QuietHours = { from: string; to: string };

function canRemind(i: ReminderInputs): i is ReminderInputs & { deadline: Date } {
  return (
    i.deadline !== null &&
    i.deletedAt === null &&
    !isClosedStatus(i.status) &&
    i.status !== ITEM_STATUS.onHold
  );
}

function notBefore(date: Date, floor: Date | null): Date {
  return floor && floor > date ? floor : date;
}

function outsideQuietHours(date: Date, windows: QuietHours[], timezone: string): Date {
  let result = date;
  for (const window of windows) {
    const from = parseClock(window.from);
    const to = parseClock(window.to);
    if (from === null || to === null || from === to) continue;
    const mins = minutesOfDay(toLocal(result, timezone));
    const overnight = from > to;
    if (overnight && mins >= from) result = atLocalClock(result, to, timezone, 1);
    else if (overnight && mins < to) result = atLocalClock(result, to, timezone);
    else if (!overnight && mins >= from && mins < to) result = atLocalClock(result, to, timezone);
  }
  return result;
}

// When something sent right now may go out, given the user's and the bucket's quiet hours
export function afterQuietHours(
  now: Date,
  windows: (QuietHours | null | undefined)[],
  timezone: string
): Date {
  const set = windows.filter((w): w is QuietHours => !!w);
  let result = now;
  for (let jump = 0; jump < MAX_DELIVERY_WINDOW_JUMPS; jump++) {
    const next = outsideQuietHours(result, set, timezone);
    if (next.getTime() === result.getTime()) break;
    result = next;
  }
  return result;
}

function quietWindows(i: ReminderInputs): QuietHours[] {
  return [i.rules.quietHours, i.userQuietHours].filter((w): w is QuietHours => !!w);
}

// "Notify at" and every quiet window, until none of them moves the time any more
function applyDeliveryWindow(date: Date, i: ReminderInputs, useNotifyAt: boolean): Date {
  const notifyAt = useNotifyAt && i.rules.notifyAt ? parseClock(i.rules.notifyAt) : null;
  let result = date;
  for (let jump = 0; jump < MAX_DELIVERY_WINDOW_JUMPS; jump++) {
    const start = result.getTime();
    if (notifyAt !== null && minutesOfDay(toLocal(result, i.timezone)) < notifyAt) {
      result = atLocalClock(result, notifyAt, i.timezone);
    }
    result = outsideQuietHours(result, quietWindows(i), i.timezone);
    if (result.getTime() === start) break;
  }
  return result;
}

// The moment a reminder aims at: the deadline, or for an all-day item a time on that day
export function reminderBase(
  deadline: Date,
  notifyAt: string | null | undefined,
  timezone: string
): Date {
  if (!isAllDay(deadline, timezone)) return deadline;
  const mins = (notifyAt ? parseClock(notifyAt) : null) ?? ALL_DAY_REMINDER_MINS;
  return atLocalClock(deadline, mins, timezone);
}

// Earliest first
export function reminderTimes(base: Date, offsets: number[]): Date[] {
  return offsets
    .map((mins) => new Date(base.getTime() - mins * 60_000))
    .sort((a, b) => a.getTime() - b.getTime());
}

function picksAChannel(i: ReminderInputs): boolean {
  return i.rules.medium.length > 0 || i.rules.webhooks.length > 0;
}

export function nextDeadlineReminder(i: ReminderInputs): Date | null {
  if (!canRemind(i) || !picksAChannel(i)) return null;

  const base = reminderBase(i.deadline, i.rules.notifyAt, i.timezone);
  const times = reminderTimes(base, i.reminderOffsets ?? i.rules.defaultReminders);
  const notifiedAt = i.notifiedAt;
  // Reminders that fell due before the last one went out are dropped: one ping, not a burst
  const pending = notifiedAt ? times.find((t) => t > notifiedAt) : times[0];

  let due: Date;
  if (pending) {
    due = pending;
  } else if (notifiedAt && i.rules.repeat === "daily") {
    due = addLocalDays(notifiedAt, 1, i.timezone);
  } else {
    return null;
  }

  return applyDeliveryWindow(notBefore(due, i.remindNotBefore), i, true);
}

export function nextOverdueAlert(i: ReminderInputs): Date | null {
  if (!canRemind(i) || !i.notifyWhenOverdue || !picksAChannel(i)) return null;

  let due: Date;
  if (!i.overdueNotifiedAt) {
    const delayMins = i.overdueFirstAlertMins ?? OVERDUE_FIRST_ALERT_DEFAULT_MINS;
    due = new Date(overdueFrom(i.deadline, i.timezone).getTime() + delayMins * 60_000);
  } else if (i.overdueRepeatHours) {
    due = new Date(i.overdueNotifiedAt.getTime() + i.overdueRepeatHours * 3_600_000);
  } else {
    return null;
  }

  return applyDeliveryWindow(notBefore(due, i.remindNotBefore), i, false);
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
    overdueFrom(i.deadline, i.timezone).getTime() + firstAlertMs <= at.getTime();
  return overdueByThen
    ? { remindNotBefore: at, overdueNotifiedAt: null, notifiedAt: i.notifiedAt ?? now }
    : { remindNotBefore: at, notifiedAt: null };
}

import { LAST_DAY_OF_MONTH } from "@/constants";
import { RecurringConfig } from "@/types/rules";
import {
  addLocalDays,
  fromLocal,
  localDateString,
  localDateTimeToDate,
  localDateToDate,
  toLocal,
} from "@/lib/reminders/zoned";

export function parseRecurring(raw: string | null): RecurringConfig | null {
  if (!raw) return null;
  try {
    return RecurringConfig.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function shiftMonths(deadline: Date, months: number, anchorDay: number, timezone: string): Date {
  const l = toLocal(deadline, timezone);
  const index = l.year * 12 + (l.month - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  const day = Math.min(anchorDay, daysInMonth(year, month));
  return fromLocal({ year, month, day, hour: l.hour, minute: l.minute }, timezone);
}

// Weeks run Monday to Sunday: the next picked day this week, else the first one `interval` weeks on
function nextPickedWeekday(
  deadline: Date,
  weekdays: number[],
  interval: number,
  timezone: string
): Date {
  const l = toLocal(deadline, timezone);
  const fromMonday = (day: number) => (day + 6) % 7;
  const today = fromMonday(new Date(Date.UTC(l.year, l.month - 1, l.day)).getUTCDay());
  const picked = [...new Set(weekdays.map(fromMonday))].sort((a, b) => a - b);
  const later = picked.find((d) => d > today);
  const offset =
    later !== undefined ? later - today : 7 - today + 7 * (interval - 1) + (picked[0] ?? today);
  return addLocalDays(deadline, offset, timezone);
}

// Steps in the user's local calendar so the clock time survives DST changes
function advance(deadline: Date, config: RecurringConfig, timezone: string): Date {
  const n = config.interval;
  const anchorDay = config.anchorDay ?? toLocal(deadline, timezone).day;
  switch (config.frequency) {
    case "daily":
      return addLocalDays(deadline, n, timezone);
    case "weekly":
      return config.weekdays?.length
        ? nextPickedWeekday(deadline, config.weekdays, n, timezone)
        : addLocalDays(deadline, n * 7, timezone);
    case "monthly":
      return shiftMonths(deadline, n, anchorDay, timezone);
    case "yearly":
      return shiftMonths(deadline, n * 12, anchorDay, timezone);
  }
}

function withinEnd(next: Date, config: RecurringConfig, timezone: string): Date | null {
  if (!config.endDate) return next;
  const endsAfter = addLocalDays(localDateToDate(config.endDate, timezone), 1, timezone);
  return next < endsAfter ? next : null;
}

// Skips past dates; null once the series has ended (the end date counts as a whole day)
export function nextOccurrenceDate(
  deadline: Date,
  config: RecurringConfig,
  timezone: string,
  now = new Date()
): Date | null {
  if (!config.enabled) return null;
  let next = advance(deadline, config, timezone);
  while (next <= now) next = advance(next, config, timezone);
  return withinEnd(next, config, timezone);
}

export function followingOccurrence(
  deadline: Date,
  config: RecurringConfig,
  timezone: string
): Date | null {
  if (!config.enabled) return null;
  return withinEnd(advance(deadline, config, timezone), config, timezone);
}

export type Occurrence = { deadline: Date; scheduledAt: Date | null };

export function seriesDate(occurrence: Occurrence): Date {
  return occurrence.scheduledAt ?? occurrence.deadline;
}

export function nextInSeries(
  occurrence: Occurrence,
  config: RecurringConfig,
  timezone: string,
  now = new Date()
): Date | null {
  const after = occurrence.deadline > now ? occurrence.deadline : now;
  return nextOccurrenceDate(seriesDate(occurrence), config, timezone, after);
}

export function nextAfterCompletion(
  deadline: Date,
  config: RecurringConfig,
  timezone: string,
  completedAt: Date
): Date | null {
  if (!config.enabled) return null;
  const time = toLocal(deadline, timezone);
  const base = localDateTimeToDate(
    localDateString(completedAt, timezone),
    time.hour,
    time.minute,
    timezone
  );
  const next = advance(base, { ...config, anchorDay: undefined }, timezone);
  return withinEnd(next, config, timezone);
}

export function isLastDayRepeat(config: RecurringConfig | null | undefined): boolean {
  return (
    !!config?.enabled && config.frequency === "monthly" && config.anchorDay === LAST_DAY_OF_MONTH
  );
}

export function onLastDayIfAnchored(
  deadline: Date,
  config: RecurringConfig | null,
  timezone: string
): Date {
  if (!isLastDayRepeat(config)) return deadline;
  const local = toLocal(deadline, timezone);
  const lastDay = new Date(Date.UTC(local.year, local.month, 0)).getUTCDate();
  return fromLocal({ ...local, day: lastDay }, timezone);
}

// Pins the series' day of month the first time it repeats
export function withAnchor(
  config: RecurringConfig,
  deadline: Date,
  timezone: string
): RecurringConfig {
  if (config.anchorDay || (config.frequency !== "monthly" && config.frequency !== "yearly")) {
    return config;
  }
  return { ...config, anchorDay: toLocal(deadline, timezone).day };
}

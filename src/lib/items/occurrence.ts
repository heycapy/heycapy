import { RecurringConfig } from "@/types/rules";
import { addLocalDays, fromLocal, localDateToDate, toLocal } from "@/lib/reminders/zoned";

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

// Steps in the user's local calendar so the clock time survives DST changes
function advance(deadline: Date, config: RecurringConfig, timezone: string): Date {
  const n = config.interval;
  const anchorDay = config.anchorDay ?? toLocal(deadline, timezone).day;
  switch (config.frequency) {
    case "daily":
      return addLocalDays(deadline, n, timezone);
    case "weekly":
      return addLocalDays(deadline, n * 7, timezone);
    case "monthly":
      return shiftMonths(deadline, n, anchorDay, timezone);
    case "yearly":
      return shiftMonths(deadline, n * 12, anchorDay, timezone);
  }
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
  if (!config.endDate) return next;
  const endsAfter = addLocalDays(localDateToDate(config.endDate, timezone), 1, timezone);
  return next < endsAfter ? next : null;
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

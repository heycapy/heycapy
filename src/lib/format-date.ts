import { RELATIVE_DAY_NAMES, MONTH_SHORT_NAMES, WEEKDAY_SHORT_NAMES } from "@/constants";
import { isAllDay, onViewerClock, toLocal } from "@/lib/reminders/zoned";

function localDayNumber(date: Date, timezone: string): number {
  const l = toLocal(date, timezone);
  return Date.UTC(l.year, l.month - 1, l.day) / 86_400_000;
}

// "today, 4:30 PM", "tomorrow", "Fri, Mar 13" — all-day dates leave out the time
export function formatWhen(
  date: Date,
  now: Date,
  timezone: string,
  allDay = isAllDay(date, timezone)
): string {
  const local = toLocal(date, timezone);
  const dayDiff = localDayNumber(date, timezone) - localDayNumber(now, timezone);
  const day =
    RELATIVE_DAY_NAMES[dayDiff] ??
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      month: "short",
      day: "numeric",
      ...(local.year !== toLocal(now, timezone).year && { year: "numeric" }),
    }).format(date);
  if (allDay) return day;
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `${day}, ${time}`;
}

// An item's deadline on the viewer's clock; an all-day item shows its own date to everyone
export function formatDeadline(
  deadline: Date,
  deadlineTimezone: string | null | undefined,
  now: Date,
  timezone: string
): string {
  const allDay = isAllDay(deadline, deadlineTimezone ?? timezone);
  return formatWhen(onViewerClock(deadline, deadlineTimezone, timezone), now, timezone, allDay);
}

// "09:00" → "9am", "15:30" → "3:30pm"
export function formatSlot(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":");
  const h = parseInt(hStr ?? "0");
  const m = parseInt(mStr ?? "0");
  const period = h < 12 ? "am" : "pm";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12}${period}` : `${h12}:${String(m).padStart(2, "0")}${period}`;
}

// Compact, in the browser's own timezone
export function formatShort(d: Date, allDay = d.getHours() === 0 && d.getMinutes() === 0): string {
  const date = `${MONTH_SHORT_NAMES[d.getMonth()]} ${d.getDate()}`;
  return allDay ? date : `${date} ${clockTime(d)}`;
}

// Just the time when it's today
export function formatShortTime(d: Date, now: Date): string {
  return d.toDateString() === now.toDateString() ? clockTime(d) : formatShort(d);
}

export function formatWeekdayDate(d: Date): string {
  return `${WEEKDAY_SHORT_NAMES[d.getDay()]} ${MONTH_SHORT_NAMES[d.getMonth()]} ${d.getDate()}`;
}

export function clockTime(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  const min = m > 0 ? `:${String(m).padStart(2, "0")}` : "";
  return `${hour}${min}${ampm}`;
}

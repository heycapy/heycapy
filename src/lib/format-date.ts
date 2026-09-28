import { RELATIVE_DAY_NAMES, MONTH_SHORT_NAMES } from "@/constants";
import { toLocal } from "@/lib/reminders/zoned";

function localDayNumber(date: Date, timezone: string): number {
  const l = toLocal(date, timezone);
  return Date.UTC(l.year, l.month - 1, l.day) / 86_400_000;
}

// "today, 4:30 PM", "tomorrow", "Fri, Mar 13" — all-day dates leave out the time
export function formatWhen(date: Date, now: Date, timezone: string): string {
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
  if (local.hour === 0 && local.minute === 0) return day;
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `${day}, ${time}`;
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
export function formatShort(d: Date): string {
  const date = `${MONTH_SHORT_NAMES[d.getMonth()]} ${d.getDate()}`;
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  if (!hasTime) return date;
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  const min = m > 0 ? `:${String(m).padStart(2, "0")}` : "";
  return `${date} ${hour}${min}${ampm}`;
}

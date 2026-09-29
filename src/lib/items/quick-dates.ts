import { QUICK_DATES } from "@/constants";
import { buildDeadline, deadlineDate, defaultTimeFor } from "@/lib/time";

export type QuickDate = { label: string; value: string; at: Date; allDay: boolean };

function isAllDay(d: Date): boolean {
  return d.getHours() === 0 && d.getMinutes() === 0;
}

function localDate(d: Date): string {
  return deadlineDate(d.toISOString());
}

function toDate(value: string): Date {
  if (value.includes("T")) return new Date(value);
  const [year = 0, month = 1, day = 1] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function deadlineOn(date: string, current: Date | null, now = new Date()): string {
  if (current && isAllDay(current)) return date;
  if (current) {
    const kept = toDate(date);
    kept.setHours(current.getHours(), current.getMinutes());
    if (date !== localDate(now) || kept > now) return kept.toISOString();
  }
  const time = defaultTimeFor(date, now);
  return buildDeadline(date, time.hour, time.min, time.ampm);
}

export function quickDates(current: Date | null, now = new Date()): QuickDate[] {
  return QUICK_DATES.map(({ label, days }) => {
    const value = deadlineOn(
      localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days)),
      current,
      now
    );
    return { label, value, at: toDate(value), allDay: !value.includes("T") };
  }).filter((option) => option.at.getTime() !== current?.getTime());
}

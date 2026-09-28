import { localDateToDate } from "@/lib/reminders/zoned";

export type Ampm = "am" | "pm";

export function toH24(h12: number, ampm: Ampm): number {
  if (ampm === "am") return h12 === 12 ? 0 : h12;
  return h12 === 12 ? 12 : h12 + 12;
}

export function toH12(h24: number): { hour: string; ampm: Ampm } {
  const isPm = h24 >= 12;
  const h = isPm ? (h24 === 12 ? 12 : h24 - 12) : h24 === 0 ? 12 : h24;
  return { hour: String(h), ampm: isPm ? "pm" : "am" };
}

export function buildDeadline(date: string, hour: string, min: string, ampm: Ampm): string {
  if (!date) return "";
  const h = parseInt(hour, 10);
  if (!hour.trim() || !Number.isFinite(h)) return date;
  const local = `${date}T${String(toH24(h, ampm)).padStart(2, "0")}:${min.padStart(2, "0")}:00`;
  const d = new Date(local);
  return isNaN(d.getTime()) ? date : d.toISOString();
}

// A date without a time is an all-day item: midnight in the user's timezone
export function parseDeadlineString(deadline: string, timezone: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(deadline)
    ? localDateToDate(deadline, timezone)
    : new Date(deadline);
}

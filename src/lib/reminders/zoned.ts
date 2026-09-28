export type LocalDateTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export function toLocal(date: Date, timezone: string): LocalDateTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

function offsetMs(date: Date, timezone: string): number {
  const l = toLocal(date, timezone);
  const asUtc = Date.UTC(l.year, l.month - 1, l.day, l.hour, l.minute);
  return asUtc - Math.floor(date.getTime() / 60_000) * 60_000;
}

// Overflowing fields roll over; a time skipped by DST moves past the gap
export function fromLocal(local: LocalDateTime, timezone: string): Date {
  const naive = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  const first = naive - offsetMs(new Date(naive), timezone);
  const second = naive - offsetMs(new Date(first), timezone);
  for (const candidate of [first, second]) {
    const l = toLocal(new Date(candidate), timezone);
    if (Date.UTC(l.year, l.month - 1, l.day, l.hour, l.minute) === naive) {
      return new Date(candidate);
    }
  }
  return new Date(Math.max(first, second));
}

export function minutesOfDay(local: LocalDateTime): number {
  return local.hour * 60 + local.minute;
}

export function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return h < 24 && m < 60 ? h * 60 + m : null;
}

export function addLocalDays(date: Date, days: number, timezone: string): Date {
  const l = toLocal(date, timezone);
  return fromLocal({ ...l, day: l.day + days }, timezone);
}

export function atLocalClock(date: Date, minutes: number, timezone: string, dayOffset = 0): Date {
  const l = toLocal(date, timezone);
  return fromLocal(
    {
      year: l.year,
      month: l.month,
      day: l.day + dayOffset,
      hour: Math.floor(minutes / 60),
      minute: minutes % 60,
    },
    timezone
  );
}

// An all-day item is stored as midnight in the user's timezone
export function isAllDay(date: Date, timezone: string): boolean {
  const l = toLocal(date, timezone);
  return l.hour === 0 && l.minute === 0;
}

// "YYYY-MM-DD" → midnight of that day in the timezone
export function localDateToDate(date: string, timezone: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return fromLocal(
    { year: year ?? 0, month: month ?? 1, day: day ?? 1, hour: 0, minute: 0 },
    timezone
  );
}

export function localDateString(date: Date, timezone: string): string {
  const l = toLocal(date, timezone);
  return `${l.year}-${String(l.month).padStart(2, "0")}-${String(l.day).padStart(2, "0")}`;
}

// When an item starts counting as overdue: its time, or the end of its day if it has none
export function overdueFrom(deadline: Date, timezone: string): Date {
  return isAllDay(deadline, timezone) ? addLocalDays(deadline, 1, timezone) : deadline;
}

// "YYYY-MM-DD" at hour:minute in the timezone
export function localDateTimeToDate(
  date: string,
  hour: number,
  minute: number,
  timezone: string
): Date {
  const [year, month, day] = date.split("-").map(Number);
  return fromLocal({ year: year ?? 0, month: month ?? 1, day: day ?? 1, hour, minute }, timezone);
}

// Date-only is all day; a naive datetime is local time; anything with Z or an offset is exact
export function parseLocalDateTime(value: string, timezone: string): Date {
  const s = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return localDateToDate(s, timezone);
  const naive = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/);
  if (naive)
    return localDateTimeToDate(naive[1] ?? "", Number(naive[2]), Number(naive[3]), timezone);
  return new Date(s);
}

export function endOfMonthDateString(date: Date, timezone: string): string {
  const l = toLocal(date, timezone);
  const lastDay = new Date(Date.UTC(l.year, l.month, 0)).getUTCDate();
  return `${l.year}-${String(l.month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

// e.g. "+05:30"
export function utcOffset(date: Date, timezone: string): string {
  const mins = Math.round(offsetMs(date, timezone) / 60_000);
  const abs = Math.abs(mins);
  return `${mins >= 0 ? "+" : "-"}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

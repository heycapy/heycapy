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

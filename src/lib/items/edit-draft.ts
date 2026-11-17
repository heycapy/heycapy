import {
  buildDeadline,
  deadlineDate,
  defaultTimeFor,
  lastDayOfMonth,
  timeOfDeadline,
  type Ampm,
} from "@/lib/time";
import { isLastDayRepeat } from "@/lib/items/occurrence";
import type { FieldDef, RecurringConfig } from "@/types/rules";

export type ClockTime = { hour: string; min: string; ampm: Ampm };

type Dated = { deadline: string; recurring: RecurringConfig | null };

// A set time is read from the deadline on the current clock; all day falls back to the remembered one
export function timeOf(deadline: string, zone: string, remembered: ClockTime): ClockTime {
  return deadline.includes("T") ? timeOfDeadline(deadline, zone) : remembered;
}

export function pickDate(
  { deadline, recurring }: Dated,
  picked: string,
  time: ClockTime,
  zone: string,
  now: Date
): Dated & { time: ClockTime } {
  const date = picked && isLastDayRepeat(recurring) ? lastDayOfMonth(picked) : picked;
  const next = deadline ? time : defaultTimeFor(date, now, zone);
  return {
    deadline: buildDeadline(date, next.hour, next.min, next.ampm, zone),
    recurring: picked ? recurring : null,
    time: next,
  };
}

export function pickTime(deadline: string, time: ClockTime, zone: string): string {
  const date = deadlineDate(deadline, zone);
  return date ? buildDeadline(date, time.hour, time.min, time.ampm, zone) : deadline;
}

export function pickRepeat(
  { deadline }: Dated,
  next: RecurringConfig | null,
  time: ClockTime,
  zone: string
): Dated {
  const date = deadlineDate(deadline, zone);
  return {
    recurring: next,
    deadline:
      date && isLastDayRepeat(next)
        ? buildDeadline(lastDayOfMonth(date), time.hour, time.min, time.ampm, zone)
        : deadline,
  };
}

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string" && !value.trim()) return true;
  return Array.isArray(value) && value.length === 0;
}

export function firstMissingRequired(
  fields: FieldDef[] | undefined,
  properties: Record<string, unknown> | undefined
): FieldDef | undefined {
  return fields?.find((f) => f.validation?.required && isEmpty(properties?.[f.key]));
}

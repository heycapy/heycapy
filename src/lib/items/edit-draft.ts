import { DATE_SHORTCUTS } from "@/constants";
import { addLocalDays, localDateString } from "@/lib/reminders/zoned";
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

// What a save changes: a field left out stays as it is, `null` clears it
export type ItemPatch = {
  title?: string;
  deadline?: string | null;
  status?: string;
  recurring?: RecurringConfig | null;
  properties?: Record<string, unknown> | null;
  reminders?: number[] | null;
  assigneeIds?: number[];
  clock?: string | null;
};

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

export type InlineDraft = { title: string; deadline: string; recurring: RecurringConfig | null };

// What changed since `saved`; an empty title is dropped, so closing on one keeps the old title
export function inlinePatch(
  saved: InlineDraft,
  draft: InlineDraft,
  clock: string | null
): ItemPatch {
  const patch: ItemPatch = {};
  const title = draft.title.trim();
  if (title && title !== saved.title) patch.title = title;
  if (draft.deadline !== saved.deadline) {
    patch.deadline = draft.deadline || null;
    patch.clock = clock;
  }
  if (JSON.stringify(draft.recurring) !== JSON.stringify(saved.recurring)) {
    patch.recurring = draft.recurring;
  }
  return patch;
}

export function dateShortcuts(now: Date, zone: string): { label: string; value: string }[] {
  return DATE_SHORTCUTS.map(({ label, days }) => ({
    label,
    value: localDateString(addLocalDays(now, days, zone), zone),
  }));
}

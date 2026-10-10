import { isAllDay, localDateString, parseLocalDateTime, sameDateOn } from "@/lib/reminders/zoned";

export type Due = { deadline: Date | null; deadlineTimezone: string | null };

export function dueOn(deadline: Date | null, timezone: string): Due {
  return { deadline, deadlineTimezone: deadline ? timezone : null };
}

// Read on the setter's clock; a value naming the saved deadline keeps it as it is, so re-saving
// someone else's all-day item can't move it to another clock
export function resolveDeadline(value: string | null, timezone: string, saved?: Due): Due {
  if (!value) return { deadline: null, deadlineTimezone: null };
  const parsed = parseLocalDateTime(value, timezone);
  if (saved?.deadline && saved.deadlineTimezone) {
    const savedAllDay = isAllDay(saved.deadline, saved.deadlineTimezone);
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
    const sameDate =
      dateOnly &&
      savedAllDay &&
      localDateString(saved.deadline, saved.deadlineTimezone) === value.trim();
    const sameTime = !dateOnly && !savedAllDay && parsed.getTime() === saved.deadline.getTime();
    if (sameDate || sameTime) return saved;
  }
  return dueOn(parsed, timezone);
}

// The same deadline told on another clock: an all-day date stays that date, a time stays that moment
export function onClock(
  due: Due & { deadline: Date },
  timezone: string
): Due & { deadline: Date; deadlineTimezone: string } {
  const zone = due.deadlineTimezone ?? timezone;
  return {
    deadline: isAllDay(due.deadline, zone)
      ? sameDateOn(due.deadline, zone, timezone)
      : due.deadline,
    deadlineTimezone: timezone,
  };
}

import { formatDeadline, formatWhen, timeIn } from "@/lib/format-date";
import { isAllDay, localDateString, offsetMinutes } from "@/lib/reminders/zoned";
import { placeName } from "./place";

const placeOf = (timezone: string) => placeName(timezone) ?? "UTC";

// An all-day date is the same for everyone.
export function deadlineOnBothClocks(
  deadline: Date,
  deadlineTimezone: string | null | undefined,
  now: Date,
  timezone: string
): string {
  const text = formatDeadline(deadline, deadlineTimezone, now, timezone);
  if (!deadlineTimezone || isAllDay(deadline, deadlineTimezone)) return text;
  if (offsetMinutes(deadline, deadlineTimezone) === offsetMinutes(deadline, timezone)) return text;
  const theirs =
    localDateString(deadline, deadlineTimezone) === localDateString(deadline, timezone)
      ? timeIn(deadline, deadlineTimezone)
      : formatWhen(deadline, now, deadlineTimezone, false);
  return `${text} ${placeOf(timezone)} (${theirs} ${placeOf(deadlineTimezone)})`;
}

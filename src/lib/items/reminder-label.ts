import { REMINDER_UNITS } from "@/lib/reminders/constants";

// An all-day item's reminders count back from its reminder time on that day, not from midnight
export function describeReminder(mins: number, allDay: boolean): string {
  if (mins === 0) return allDay ? "on the day" : "at time";
  const unit = REMINDER_UNITS.find((u) => mins % u.mins === 0) ?? REMINDER_UNITS[3];
  const n = mins / unit.mins;
  const plural = n === 1 || unit.name === "min" ? "" : "s";
  return `${n} ${unit.name}${plural} before`;
}

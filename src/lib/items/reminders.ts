import type { ReminderContext } from "@/lib/reminders/refresh";
import { reminderBase, reminderTimes } from "@/lib/reminders/schedule";
import { overdueFrom } from "@/lib/reminders/zoned";

type ReminderState = { deadline: Date | null; notifiedAt: Date | null };
type OffsetState = ReminderState & { reminderOffsets: number[] | null };

// A date that's already past gets no "due" reminder; its overdue alert still fires
export function initialReminderState(
  deadline: Date | null | undefined,
  timezone: string,
  now = new Date()
): { notifiedAt?: Date } {
  return deadline && overdueFrom(deadline, timezone) < now ? { notifiedAt: now } : {};
}

export function reminderResetForDeadline(
  item: OffsetState,
  newDeadline: Date | null,
  ctx: ReminderContext,
  now = new Date()
): { notifiedAt?: Date | null; overdueNotifiedAt?: null; remindNotBefore?: Date | null } {
  const unchanged = (item.deadline?.getTime() ?? null) === (newDeadline?.getTime() ?? null);
  if (unchanged) return {};
  const inPast = !!newDeadline && overdueFrom(newDeadline, ctx.timezone) < now;
  const base = newDeadline ? reminderBase(newDeadline, ctx.notifyAt, ctx.timezone) : null;
  const times = base ? reminderTimes(base, item.reminderOffsets ?? ctx.defaultReminders) : [];
  // Already reminded: reminders whose time passed would re-ping at once, so wait for the next one ahead
  const hold =
    base && !inPast && item.notifiedAt !== null && times.some((t) => t < now)
      ? (times.find((t) => t >= now) ?? base)
      : null;
  return {
    overdueNotifiedAt: null,
    notifiedAt: inPast ? (item.notifiedAt ?? now) : null,
    remindNotBefore: hold,
  };
}

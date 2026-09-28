import type { ReminderContext } from "@/lib/reminders/refresh";
import { reminderBase } from "@/lib/reminders/schedule";
import { overdueFrom } from "@/lib/reminders/zoned";

type ReminderState = { deadline: Date | null; notifiedAt: Date | null };
type OffsetState = ReminderState & { notificationOffsetMins: number | null };

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
  const offsetMs = (item.notificationOffsetMins ?? ctx.defaultOffsetMins) * 60_000;
  // Already reminded: an early reminder whose time passed would re-ping at once, so wait for the deadline
  const holdUntilDeadline =
    !!base && !inPast && item.notifiedAt !== null && base.getTime() - offsetMs < now.getTime();
  return {
    overdueNotifiedAt: null,
    notifiedAt: inPast ? (item.notifiedAt ?? now) : null,
    remindNotBefore: holdUntilDeadline ? base : null,
  };
}

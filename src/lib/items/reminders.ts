type ReminderState = { deadline: Date | null; notifiedAt: Date | null };
type OffsetState = ReminderState & { notificationOffsetMins: number | null };

// a date that's already past gets no "due" reminder; its overdue alert still fires
export function initialReminderState(
  deadline: Date | null | undefined,
  now = new Date()
): { notifiedAt?: Date } {
  return deadline && deadline < now ? { notifiedAt: now } : {};
}

export function reminderResetForDeadline(
  item: OffsetState,
  newDeadline: Date | null,
  defaultOffsetMins: number,
  now = new Date()
): { notifiedAt?: Date | null; overdueNotifiedAt?: null; remindNotBefore?: Date | null } {
  const unchanged = (item.deadline?.getTime() ?? null) === (newDeadline?.getTime() ?? null);
  if (unchanged) return {};
  const inPast = !!newDeadline && newDeadline < now;
  const offsetMs = (item.notificationOffsetMins ?? defaultOffsetMins) * 60_000;
  // Already reminded: an early reminder whose time passed would re-ping at once, so wait for the deadline
  const holdUntilDeadline =
    !!newDeadline &&
    !inPast &&
    item.notifiedAt !== null &&
    newDeadline.getTime() - offsetMs < now.getTime();
  return {
    overdueNotifiedAt: null,
    notifiedAt: inPast ? (item.notifiedAt ?? now) : null,
    remindNotBefore: holdUntilDeadline ? newDeadline : null,
  };
}

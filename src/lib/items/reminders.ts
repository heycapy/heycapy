type ReminderState = { deadline: Date | null; notifiedAt: Date | null };

// a date that's already past gets no "due" reminder; its overdue alert still fires
export function initialReminderState(
  deadline: Date | null | undefined,
  now = new Date()
): { notifiedAt?: Date } {
  return deadline && deadline < now ? { notifiedAt: now } : {};
}

export function reminderResetForDeadline(
  item: ReminderState,
  newDeadline: Date | null,
  now = new Date()
): { notifiedAt?: Date | null; overdueNotifiedAt?: null } {
  const unchanged = (item.deadline?.getTime() ?? null) === (newDeadline?.getTime() ?? null);
  if (unchanged) return {};
  return {
    overdueNotifiedAt: null,
    notifiedAt: newDeadline && newDeadline < now ? (item.notifiedAt ?? now) : null,
  };
}

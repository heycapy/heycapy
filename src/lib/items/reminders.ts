type ReminderState = { deadline: Date | null; notifiedAt: Date | null };

export function reminderResetForDeadline(
  item: ReminderState,
  newDeadline: Date | null,
  now = new Date()
): { notifiedAt?: Date | null; overdueNotifiedAt?: null } {
  const unchanged = (item.deadline?.getTime() ?? null) === (newDeadline?.getTime() ?? null);
  if (unchanged) return {};
  return {
    overdueNotifiedAt: null,
    // Moved into the past: don't fire immediately
    notifiedAt: newDeadline && newDeadline < now ? item.notifiedAt : null,
  };
}

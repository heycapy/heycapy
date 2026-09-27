type ReminderState = { deadline: Date | null; notifiedAt: Date | null };

/**
 * Reminder bookkeeping to apply when an item's deadline changes, so every path that edits
 * deadlines (web, assistant, telegram) re-arms reminders the same way.
 */
export function reminderResetForDeadline(
  item: ReminderState,
  newDeadline: Date | null,
  now = new Date()
): { notifiedAt?: Date | null; overdueNotifiedAt?: null } {
  const unchanged = (item.deadline?.getTime() ?? null) === (newDeadline?.getTime() ?? null);
  if (unchanged) return {};
  return {
    overdueNotifiedAt: null,
    // Moving to a time that has already passed must not fire an instant reminder
    notifiedAt: newDeadline && newDeadline < now ? item.notifiedAt : null,
  };
}

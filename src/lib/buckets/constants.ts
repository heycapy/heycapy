export const SETTING_LABELS: Record<string, string> = {
  sortBy: "sort by",
  drag: "allow drag",
  readonly: "read only",
  showCompleted: "show completed",
  defaultDeadlineOffsetDays: "default deadline offset",
  recurrenceMode: "repeating items",
  medium: "channels",
  reminderButtons: "reminder buttons",
  notifyAt: "remind at",
  defaultReminders: "reminders",
  repeat: "deadline repeat",
  notifyOnArrival: "notify on arrival",
  notifyWhenOverdue: "notify when overdue",
  overdueRepeatHours: "overdue repeat",
  overdueFirstAlertMins: "first overdue alert",
};

export const INVITE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 8;
export const INVITE_TTL_MS = 48 * 60 * 60 * 1000;
export const INVITE_ACTIVE_MAX = 10;
export const BUCKET_MEMBERS_MAX = 5;
export const INVITE_FAIL_MAX = 5;
export const INVITE_LOCKOUT_MS = 15 * 60 * 1000;

export const QUEUE_DEFAULT_MAX_ATTEMPTS = 3;
export const QUEUE_PROCESS_BATCH_SIZE = 50;
export const QUEUE_RETRY_DELAY_MINS = [1, 5, 15] as const;
export const QUEUE_SENDING_LEASE_MS = 10 * 60 * 1000;
export const DELIVERY_TIMEOUT_MS = 30_000;
// a reminder older than a day is stale; the push service drops it instead of delivering late
export const PUSH_TTL_SECONDS = 24 * 60 * 60;
export const PUSH_DEVICE_NAME_MAX_LENGTH = 60;
export const PUSH_DEVICES_MAX = 20;
export const CHANNEL_FAILURE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const WEBHOOK_RATE_LIMIT_MAX = 120;
export const WEBHOOK_RATE_LIMIT_WINDOW_MS = 60_000;

export const QUICK_REMIND_OPTIONS = [
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
  { value: "60", label: "1 hour" },
  { value: "tomorrow", label: "Tomorrow" },
] as const;

export type QuickRemindChoice = (typeof QUICK_REMIND_OPTIONS)[number]["value"];
export function reminderButtonLabel(choice: QuickRemindChoice): string {
  return QUICK_REMIND_OPTIONS.find((o) => o.value === choice)?.label.toLowerCase() ?? choice;
}
export const QUICK_REMIND_VALUES = [
  "15",
  "30",
  "60",
  "tomorrow",
] as const satisfies readonly QuickRemindChoice[];
export const DEFAULT_REMINDER_BUTTONS: QuickRemindChoice[] = ["60", "tomorrow"];

export const PUSH_REMIND_BUTTONS = 1;
export const NTFY_REMIND_BUTTONS = 2;
export const EMAIL_REMIND_BUTTONS = QUICK_REMIND_VALUES.length;
export const REMINDER_ACTION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const RESCHEDULE_DAY_LABELS = {
  today: "Today",
  tomorrow: "Tomorrow",
  this_week: "Next week",
  end_of_month: "End of month",
} as const;

export const TELEGRAM_KEYBOARD = [
  ["➕ Add", "📝 List"],
  ["📋 Today", "⚠️ Overdue"],
] as const;

export const TELEGRAM_LIST_PAGE_SIZE = 6;

import { ITEM_STATUS } from "@/constants";
import type { QuickRemindChoice } from "@/lib/notifications/constants";
import type { LucideIcon } from "lucide-react";
import { Activity, Bell, Briefcase, CreditCard, ListTodo, Square } from "lucide-react";
import type { RecurrenceMode, StatusDef } from "@/types/rules";
import { REMINDER_UNITS } from "@/lib/reminders/constants";

export type SortBy = "deadline" | "created_at" | "manual";
export type NotificationMedium = "ntfy" | "email" | "telegram" | "push";
export type RepeatMode = "once" | "daily";

export type ItemsRulesConfig = {
  recurrenceMode?: RecurrenceMode;
  sortBy?: SortBy;
  drag?: boolean;
  readonly?: boolean;
  showCompleted?: boolean;
  defaultDeadlineOffsetDays?: number | null;
};

export type NotificationsRulesConfig = {
  medium?: NotificationMedium[];
  reminderButtons?: QuickRemindChoice[];
  notifyAt?: string;
  defaultReminders?: number[];
  repeat?: RepeatMode;
  quietHours?: { from: string; to: string } | null;
};

export const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  Blank: Square,
  Subscriptions: CreditCard,
  Reminders: Bell,
  Todo: ListTodo,
  Work: Briefcase,
  "CI/CD Monitor": Activity,
};

export type ItemStatus = string;

export const DEFAULT_BUCKET_STATUSES: StatusDef[] = [
  { name: ITEM_STATUS.active, color: "#22c55e", isDefault: true },
  { name: ITEM_STATUS.completed, color: "#3b82f6" },
  { name: ITEM_STATUS.onHold, color: "#f59e0b" },
];

export const ITEM_HIGHLIGHT_MS = 3000;
export const MENU_GAP = 6;
export const SCREEN_MARGIN = 8;
export const UNDO_DELETE_MS = 6000;
export const LONG_PRESS_MS = 500;
export const LONG_PRESS_SLOP = 8;

export const BUCKET_PALETTE = ["var(--p1)", "var(--p2)", "var(--p3)", "var(--p4)", "var(--p5)"];

export const RECURRING_FREQUENCIES = [
  { value: "daily" as const, label: "day" },
  { value: "weekly" as const, label: "week" },
  { value: "monthly" as const, label: "month" },
  { value: "yearly" as const, label: "year" },
];

// Minutes before the deadline offered in the item form's reminder picker
export const REMINDER_PRESETS = [0, 15, 30, 60, 120, 1440, 2880, 10080];

export const CUSTOM_REMINDER_UNITS = [...REMINDER_UNITS].reverse();

export const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "deadline", label: "deadline" },
  { value: "created_at", label: "created" },
  { value: "manual", label: "manual" },
];

export const MEDIUM_OPTIONS: { value: NotificationMedium; label: string }[] = [
  { value: "email", label: "email" },
  { value: "push", label: "push" },
  { value: "telegram", label: "telegram" },
  { value: "ntfy", label: "ntfy" },
];

export const REPEAT_OPTIONS: { value: RepeatMode; label: string }[] = [
  { value: "once", label: "once" },
  { value: "daily", label: "daily" },
];

export type TelegramDeadlinePreset =
  "today" | "tomorrow" | "this_week" | "end_of_month" | "pick_date" | "no_deadline";

export type TelegramRecurringDefault = "none" | "daily" | "weekly" | "monthly" | "yearly";

export type TelegramBotConfig = {
  alias: string | null;
  deadlinePresets: TelegramDeadlinePreset[];
  showRecurring: boolean;
  defaultRecurring: TelegramRecurringDefault;
  timeSlots: string[];
};

export const DEFAULT_TELEGRAM_BOT_CONFIG: TelegramBotConfig = {
  alias: null,
  deadlinePresets: ["today", "tomorrow", "this_week", "no_deadline"],
  showRecurring: false,
  defaultRecurring: "none",
  timeSlots: ["09:00", "12:00", "15:00", "18:00", "21:00"],
};

export const TELEGRAM_TIME_SLOT_OPTIONS: { value: string; label: string }[] = Array.from(
  { length: 16 },
  (_, i) => {
    const h = i + 7;
    const value = `${String(h).padStart(2, "0")}:00`;
    const period = h < 12 ? "am" : "pm";
    const h12 = h > 12 ? h - 12 : h;
    return { value, label: `${h12}${period}` };
  }
);

export const TELEGRAM_DEADLINE_PRESETS: { value: TelegramDeadlinePreset; label: string }[] = [
  { value: "today", label: "today" },
  { value: "tomorrow", label: "tomorrow" },
  { value: "this_week", label: "this week" },
  { value: "end_of_month", label: "end of month" },
  { value: "pick_date", label: "pick date" },
  { value: "no_deadline", label: "no deadline" },
];

export const TELEGRAM_RECURRING_OPTIONS: { value: TelegramRecurringDefault; label: string }[] = [
  { value: "none", label: "none" },
  { value: "daily", label: "daily" },
  { value: "weekly", label: "weekly" },
  { value: "monthly", label: "monthly" },
  { value: "yearly", label: "yearly" },
];

export const CURRENCY_OPTIONS = [
  { value: "$", label: "$" },
  { value: "€", label: "€" },
  { value: "₹", label: "₹" },
] as const;

export type CurrencySymbol = (typeof CURRENCY_OPTIONS)[number]["value"];

export const FIELD_LABEL = "text-muted-foreground font-mono text-xs";
export const FIELD_INPUT =
  "border-b border-border w-full bg-transparent py-1.5 font-mono text-xs outline-none placeholder:text-muted-foreground/50 focus:border-foreground disabled:opacity-50";

export const RECURRENCE_MODE_OPTIONS: { value: RecurrenceMode; label: string; hint: string }[] = [
  {
    value: "wait",
    label: "wait for me",
    hint: "the next one appears when you complete this one — for bills and to-dos you still owe",
  },
  {
    value: "moveOn",
    label: "move on if missed",
    hint: "when the next date arrives, an unfinished one is marked missed — for habits",
  },
  {
    value: "afterCompletion",
    label: "after completion",
    hint: "the next date counts from when you complete it — e.g. water plants 3 days after",
  },
];

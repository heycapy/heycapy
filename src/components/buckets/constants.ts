import type { LucideIcon } from "lucide-react";
import { Activity, Bell, Briefcase, CreditCard, ListTodo, Square } from "lucide-react";
import { ON_HOLD_STATUS } from "@/constants";
import type { StatusDef } from "@/types/rules";

export type SortBy = "deadline" | "created_at" | "manual";
export type NotificationMedium = "ntfy" | "email" | "telegram";
export type RepeatMode = "once" | "daily";

export type ItemsRulesConfig = {
  sortBy?: SortBy;
  drag?: boolean;
  readonly?: boolean;
  showCompleted?: boolean;
  defaultDeadlineOffsetDays?: number | null;
};

export type NotificationsRulesConfig = {
  medium?: NotificationMedium[];
  notifyAt?: string;
  defaultOffsetMins?: number;
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
  { name: "active", color: "#22c55e", isDefault: true },
  { name: "completed", color: "#3b82f6" },
  { name: ON_HOLD_STATUS, color: "#f59e0b" },
];

export const BUCKET_PALETTE = ["var(--p1)", "var(--p2)", "var(--p3)", "var(--p4)", "var(--p5)"];

export const RECURRING_FREQUENCIES = [
  { value: "daily" as const, label: "day" },
  { value: "weekly" as const, label: "week" },
  { value: "monthly" as const, label: "month" },
  { value: "yearly" as const, label: "year" },
];

export const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "deadline", label: "deadline" },
  { value: "created_at", label: "created" },
  { value: "manual", label: "manual" },
];

export const MEDIUM_OPTIONS: { value: NotificationMedium; label: string }[] = [
  { value: "ntfy", label: "ntfy" },
  { value: "email", label: "email" },
  { value: "telegram", label: "telegram" },
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

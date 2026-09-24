import type { LucideIcon } from "lucide-react";
import { Bell, Briefcase, CreditCard, ListTodo } from "lucide-react";
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
  snoozeUntil?: string | null;
};

export const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  Subscriptions: CreditCard,
  Reminders: Bell,
  Todo: ListTodo,
  Work: Briefcase,
};

export type ItemStatus = string;

export const DEFAULT_BUCKET_STATUSES: StatusDef[] = [
  { name: "active", color: "#22c55e", isDefault: true },
  { name: "completed", color: "#3b82f6", isCompleted: true },
  { name: "snoozed", color: "#f59e0b" },
];

export const STATUS_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#6b7280",
] as const;

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

export const CURRENCY_OPTIONS = [
  { value: "$", label: "$" },
  { value: "€", label: "€" },
  { value: "₹", label: "₹" },
] as const;

export type CurrencySymbol = (typeof CURRENCY_OPTIONS)[number]["value"];

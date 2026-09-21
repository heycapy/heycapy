import type { LucideIcon } from "lucide-react";
import { Bell, Briefcase, CreditCard, GitBranch, ListTodo } from "lucide-react";

export type SortBy = "deadline" | "created_at" | "manual";
export type NotificationMedium = "ntfy" | "email";
export type PersonalityTone = "chill" | "professional" | "motivational" | "custom";
export type RepeatMode = "once" | "daily";

export type ItemsRulesConfig = {
  sort_by?: SortBy;
  drag?: boolean;
  readonly?: boolean;
  show_completed?: boolean;
  default_deadline_offset?: string | null;
  auto_archive_after?: string | null;
};

export type NotificationsRulesConfig = {
  medium?: NotificationMedium[];
  notify_at?: string;
  default_offset?: string;
  repeat?: RepeatMode;
  quiet_hours?: { from: string; to: string } | null;
};

export type PersonalityRulesConfig = {
  tone_override?: PersonalityTone | null;
};

export const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  Subscriptions: CreditCard,
  Reminders: Bell,
  Todo: ListTodo,
  Work: Briefcase,
  Linear: GitBranch,
};

export const ITEM_STATUSES = [
  { value: "active", color: "bg-[var(--status-active)]" },
  { value: "completed", color: "bg-[var(--status-completed)]" },
  { value: "snoozed", color: "bg-[var(--status-snoozed)]" },
  { value: "archived", color: "bg-[var(--status-archived)]" },
] as const;

export type ItemStatus = (typeof ITEM_STATUSES)[number]["value"];

export const BUCKET_PALETTE = ["var(--p1)", "var(--p2)", "var(--p3)", "var(--p4)", "var(--p5)"];

export const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "deadline", label: "deadline" },
  { value: "created_at", label: "created" },
  { value: "manual", label: "manual" },
];

export const MEDIUM_OPTIONS: { value: NotificationMedium; label: string }[] = [
  { value: "ntfy", label: "ntfy" },
  { value: "email", label: "email" },
];

export const REPEAT_OPTIONS: { value: RepeatMode; label: string }[] = [
  { value: "once", label: "once" },
  { value: "daily", label: "daily" },
];

export const BUCKET_TONE_OPTIONS: { value: PersonalityTone | "inherit"; label: string }[] = [
  { value: "inherit", label: "inherit" },
  { value: "chill", label: "chill" },
  { value: "professional", label: "professional" },
  { value: "motivational", label: "motivational" },
  { value: "custom", label: "custom" },
];

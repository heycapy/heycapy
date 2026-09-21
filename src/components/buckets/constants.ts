import type { LucideIcon } from "lucide-react";
import { Bell, Briefcase, CreditCard, GitBranch, ListTodo } from "lucide-react";

export const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  Subscriptions: CreditCard,
  Reminders: Bell,
  Todo: ListTodo,
  Work: Briefcase,
  Linear: GitBranch,
};

export const ITEM_STATUSES = [
  { value: "active", color: "bg-muted-foreground/40" },
  { value: "completed", color: "bg-accent" },
  { value: "snoozed", color: "bg-primary/60" },
  { value: "archived", color: "bg-muted-foreground/20" },
] as const;

export type ItemStatus = (typeof ITEM_STATUSES)[number]["value"];

export const BUCKET_PALETTE = ["var(--p1)", "var(--p2)", "var(--p3)", "var(--p4)", "var(--p5)"];

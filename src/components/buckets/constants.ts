import type { LucideIcon } from "lucide-react";
import { Bell, Briefcase, CreditCard, GitBranch, ListTodo } from "lucide-react";

export const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  Subscriptions: CreditCard,
  Reminders: Bell,
  Todo: ListTodo,
  Work: Briefcase,
  Linear: GitBranch,
};

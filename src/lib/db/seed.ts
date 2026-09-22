import { eq } from "drizzle-orm";
import { db } from "./index";
import { itemStatuses, templates } from "./schema";

const SYSTEM_STATUSES = [
  { name: "active", color: "#22c55e", sortOrder: 0, isSystem: true },
  { name: "completed", color: "#3b82f6", sortOrder: 1, isSystem: true },
  { name: "snoozed", color: "#f59e0b", sortOrder: 2, isSystem: true },
];

const BUILTIN_TEMPLATES = [
  {
    name: "Subscriptions",
    description: "Track recurring bills. Notifies 3 days + 1 day before renewal.",
    rulesJson: JSON.stringify({
      notifications: {
        medium: ["ntfy"],
        notifyAt: "09:00",
        quietHours: null,
        defaultOffsetMins: 4320,
        repeat: "once",
        snoozeUntil: null,
      },
      items: {
        sortBy: "deadline",
        drag: false,
        readonly: false,
        showCompleted: true,
        defaultDeadlineOffsetDays: 30,
      },
      personality: { toneOverride: null },
    }),
    isBuiltin: true,
  },
  {
    name: "Reminders",
    description: "General reminders. Notifies via push and email at deadline.",
    rulesJson: JSON.stringify({
      notifications: {
        medium: ["ntfy", "email"],
        notifyAt: "",
        quietHours: null,
        defaultOffsetMins: 0,
        repeat: "once",
        snoozeUntil: null,
      },
      items: {
        sortBy: "deadline",
        drag: false,
        readonly: false,
        showCompleted: true,
        defaultDeadlineOffsetDays: null,
      },
      personality: { toneOverride: null },
    }),
    isBuiltin: true,
  },
  {
    name: "Todo",
    description: "Simple manual todo list. No notifications, drag to reorder.",
    rulesJson: JSON.stringify({
      notifications: {
        medium: [],
        notifyAt: "",
        quietHours: null,
        defaultOffsetMins: 0,
        repeat: "once",
        snoozeUntil: null,
      },
      items: {
        sortBy: "manual",
        drag: true,
        readonly: false,
        showCompleted: false,
        defaultDeadlineOffsetDays: null,
      },
      personality: { toneOverride: null },
    }),
    isBuiltin: true,
  },
  {
    name: "Work",
    description: "Work tasks. Email notifications 1 day before, quiet after 6pm.",
    rulesJson: JSON.stringify({
      notifications: {
        medium: ["email"],
        notifyAt: "09:00",
        quietHours: { from: "18:00", to: "09:00" },
        defaultOffsetMins: 1440,
        repeat: "once",
        snoozeUntil: null,
      },
      items: {
        sortBy: "deadline",
        drag: false,
        readonly: false,
        showCompleted: true,
        defaultDeadlineOffsetDays: null,
      },
      personality: { toneOverride: "professional" },
    }),
    isBuiltin: true,
  },
  {
    name: "Linear",
    description: "Linear issues assigned to you with due dates.",
    rulesJson: JSON.stringify({
      notifications: {
        medium: ["ntfy"],
        notifyAt: "09:00",
        quietHours: null,
        defaultOffsetMins: 1440,
        repeat: "once",
        snoozeUntil: null,
      },
      items: {
        sortBy: "deadline",
        drag: false,
        readonly: true,
        showCompleted: false,
        defaultDeadlineOffsetDays: null,
      },
      mcp: {
        refreshMode: "interval",
        refreshIntervalMins: 15,
        allowCreate: true,
        allowEdit: false,
        filters: {},
      },
      personality: { toneOverride: null },
    }),
    isBuiltin: true,
  },
];

export async function seed(userId: number) {
  await db
    .insert(itemStatuses)
    .values(SYSTEM_STATUSES.map((s) => ({ ...s, userId })))
    .onConflictDoNothing();

  for (const t of BUILTIN_TEMPLATES) {
    const existing = await db.query.templates.findFirst({
      where: (tmpl, { and, eq, isNull }) =>
        and(eq(tmpl.name, t.name), eq(tmpl.isBuiltin, true), isNull(tmpl.userId)),
    });

    if (existing) {
      await db
        .update(templates)
        .set({ description: t.description, rulesJson: t.rulesJson })
        .where(eq(templates.id, existing.id));
    } else {
      await db.insert(templates).values({ ...t, userId: null });
    }
  }
}

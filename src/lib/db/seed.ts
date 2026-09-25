import { and, eq, isNull, notInArray } from "drizzle-orm";
import { db } from "./index";
import { templates } from "./schema";
import type { BucketSchema } from "@/types/rules";

type BuiltinTemplate = {
  name: string;
  description: string;
  rulesJson: string;
  fieldSchemaJson: string;
};

const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    name: "Reminders",
    description: "General reminders. Notifies at deadline.",
    rulesJson: JSON.stringify({
      notifications: {
        medium: ["email", "telegram"],
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
    fieldSchemaJson: JSON.stringify({
      fields: [],
      notifyWhenOverdue: true,
    } satisfies BucketSchema),
  },
  {
    name: "Subscriptions",
    description: "Track recurring bills. Notifies 3 days and 1 day before renewal.",
    rulesJson: JSON.stringify({
      notifications: {
        medium: ["email", "telegram"],
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
    fieldSchemaJson: JSON.stringify({
      fields: [
        {
          key: "amount",
          label: "Amount",
          type: "currency",
          currency: "$",
          showInRow: true,
          validation: { required: true },
        },
        {
          key: "plan",
          label: "Plan",
          type: "select",
          options: ["free", "basic", "pro", "enterprise"],
        },
        { key: "website", label: "Website", type: "url" },
        { key: "autoRenew", label: "Auto-renew", type: "boolean" },
      ],
      notifyWhenOverdue: true,
    } satisfies BucketSchema),
  },
  {
    name: "Todo",
    description: "Simple manual todo list. Drag to reorder.",
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
    fieldSchemaJson: JSON.stringify({
      fields: [
        {
          key: "priority",
          label: "Priority",
          type: "select",
          options: ["low", "medium", "high"],
          showInRow: true,
        },
      ],
      notifyWhenOverdue: true,
    } satisfies BucketSchema),
  },
  {
    name: "Work",
    description: "Work tasks with deadlines. Notifies 1 day before, quiet after 6pm.",
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
    fieldSchemaJson: JSON.stringify({
      fields: [
        {
          key: "priority",
          label: "Priority",
          type: "select",
          options: ["low", "medium", "high", "urgent"],
          showInRow: true,
        },
        { key: "project", label: "Project", type: "text" },
        { key: "notes", label: "Notes", type: "textarea" },
      ],
      notifyWhenOverdue: true,
    } satisfies BucketSchema),
  },
];

export async function seed(_userId: number) {
  for (const t of BUILTIN_TEMPLATES) {
    const existing = await db.query.templates.findFirst({
      where: (tmpl, { and, eq, isNull }) =>
        and(eq(tmpl.name, t.name), eq(tmpl.isBuiltin, true), isNull(tmpl.userId)),
    });

    if (existing) {
      await db
        .update(templates)
        .set({
          description: t.description,
          rulesJson: t.rulesJson,
          fieldSchemaJson: t.fieldSchemaJson,
        })
        .where(eq(templates.id, existing.id));
    } else {
      await db.insert(templates).values({ ...t, userId: null });
    }
  }

  const currentNames = BUILTIN_TEMPLATES.map((t) => t.name);
  await db
    .delete(templates)
    .where(
      and(
        eq(templates.isBuiltin, true),
        isNull(templates.userId),
        notInArray(templates.name, currentNames)
      )
    );
}

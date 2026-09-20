import { z } from "zod";

export const NotificationRules = z.object({
  medium: z.array(z.enum(["ntfy", "email"])).default(["ntfy"]),
  notifyAt: z.string().default("09:00"),
  quietHours: z.object({ from: z.string(), to: z.string() }).nullable().default(null),
  defaultOffsetMins: z.number().int().nonnegative().default(0),
  repeat: z.enum(["once", "daily"]).default("once"),
  snoozeUntil: z.iso.datetime().nullable().default(null),
});

export const ItemsRules = z.object({
  sortBy: z.enum(["deadline", "created_at", "manual"]).default("deadline"),
  drag: z.boolean().default(false),
  readonly: z.boolean().default(false),
  autoArchiveAfterDays: z.number().int().nonnegative().nullable().default(null),
  showCompleted: z.boolean().default(true),
  defaultDeadlineOffsetDays: z.number().int().nonnegative().nullable().default(null),
});

export const McpRules = z.object({
  refreshMode: z.enum(["manual", "interval"]).default("manual"),
  refreshIntervalMins: z.number().int().positive().nullable().default(null),
  allowCreate: z.boolean().default(false),
  allowEdit: z.boolean().default(false),
  filters: z.record(z.string(), z.unknown()).default({}),
});

export const PersonalityRules = z.object({
  toneOverride: z
    .enum(["chill", "professional", "motivational", "custom"])
    .nullable()
    .default(null),
});

export const RecurringConfig = z.object({
  enabled: z.boolean().default(false),
  frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
  interval: z.number().int().positive().default(1),
  endDate: z.iso.date().nullable().default(null),
});

export type NotificationRules = z.infer<typeof NotificationRules>;
export type ItemsRules = z.infer<typeof ItemsRules>;
export type McpRules = z.infer<typeof McpRules>;
export type PersonalityRules = z.infer<typeof PersonalityRules>;
export type RecurringConfig = z.infer<typeof RecurringConfig>;

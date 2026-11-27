import * as z from "zod/mini";
import { en } from "zod/locales";
import { DEFAULT_REMINDER_BUTTONS, QUICK_REMIND_VALUES } from "@/lib/notifications/constants";
import { MAX_REMINDER_OFFSET_MINS, MAX_REMINDERS_PER_ITEM } from "@/lib/reminders/constants";

// zod/mini ships without error messages, and webhook callers and capy read them
z.config(en());

// Minutes before the deadline, stored largest first without repeats
export const ReminderOffsets = z.pipe(
  z
    .array(z.int().check(z.minimum(0), z.maximum(MAX_REMINDER_OFFSET_MINS)))
    .check(z.maxLength(MAX_REMINDERS_PER_ITEM)),
  z.transform((offsets) => [...new Set(offsets)].sort((a, b) => b - a))
);

const CHANNEL_MEDIA = z.array(z.enum(["ntfy", "email", "telegram", "push"]));

// One person's channels for one bucket, kept on their bucket_members row
export const MemberChannels = z.object({
  medium: z._default(CHANNEL_MEDIA, []),
  // ids of the person's own outgoing webhooks, set up once in tweaks
  webhooks: z._default(z.array(z.int().check(z.positive())), []),
  // Saving tweaks copies the person's default channels into the rows that follow them
  followsTweaks: z.optional(z.boolean()),
});

export type MemberChannels = z.infer<typeof MemberChannels>;

// "overdue" covers notifyWhenOverdue, overdueFirstAlertMins and overdueRepeatHours together
export const FOLLOWABLE_SETTINGS = ["defaultReminders", "notifyAt", "repeat", "overdue"] as const;
export type FollowableSetting = (typeof FOLLOWABLE_SETTINGS)[number];

export const NotificationRules = z.object({
  notifyAt: z._default(z.string(), ""),
  quietHours: z._default(z.nullable(z.object({ from: z.string(), to: z.string() })), null),
  // For items that haven't picked their own
  defaultReminders: z._default(ReminderOffsets, [0]),
  repeat: z._default(z.enum(["once", "daily"]), "once"),
  // "Remind again" buttons shown next to Done on every channel, as much as each has room for
  reminderButtons: z._default(z.array(z.enum(QUICK_REMIND_VALUES)), DEFAULT_REMINDER_BUTTONS),
  // Saving tweaks copies the owner's defaults into these, buckets from before defaults have none
  followsTweaks: z._default(z.array(z.enum(FOLLOWABLE_SETTINGS)), []),
});

// The defaults in tweaks → notifications. The starting values are what buckets had built in
export const NotificationDefaults = z.object({
  defaultReminders: z._default(ReminderOffsets, [0]),
  notifyAt: z._default(z.string(), ""),
  repeat: z._default(z.enum(["once", "daily"]), "once"),
  notifyWhenOverdue: z._default(z.boolean(), false),
  overdueFirstAlertMins: z.optional(z.int().check(z.positive())),
  overdueRepeatHours: z.optional(z.number().check(z.positive())),
  // null until picked in tweaks: every channel set up at the time, as before defaults existed
  medium: z._default(z.nullable(CHANNEL_MEDIA), null),
});

export type NotificationDefaults = z.infer<typeof NotificationDefaults>;

export const ItemsRules = z.object({
  sortBy: z._default(z.enum(["deadline", "created_at", "manual"]), "deadline"),
  drag: z._default(z.boolean(), false),
  readonly: z._default(z.boolean(), false),
  showCompleted: z._default(z.boolean(), true),
  defaultDeadlineOffsetDays: z._default(z.nullable(z.int().check(z.nonnegative())), null),
  // How a repeating item's next occurrence comes about
  recurrenceMode: z._default(z.enum(["wait", "moveOn", "afterCompletion"]), "wait"),
});

export const McpRules = z.object({
  refreshMode: z._default(z.enum(["manual", "interval"]), "manual"),
  refreshIntervalMins: z._default(z.nullable(z.int().check(z.positive())), null),
  allowCreate: z._default(z.boolean(), false),
  allowEdit: z._default(z.boolean(), false),
  filters: z._default(z.record(z.string(), z.unknown()), {}),
});

export const PersonalityRules = z.object({
  toneOverride: z._default(
    z.nullable(z.enum(["chill", "professional", "motivational", "rude_funny", "custom"])),
    null
  ),
});

export const RecurringConfig = z.object({
  enabled: z._default(z.boolean(), false),
  frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
  interval: z._default(z.int().check(z.positive()), 1),
  endDate: z._default(z.nullable(z.iso.date()), null),
  // Day of month a monthly/yearly series was set on, so short months don't shift it
  anchorDay: z.optional(z.int().check(z.minimum(1), z.maximum(31))),
  // Weekly on these days (0 = Sunday), without it, the deadline's own weekday
  weekdays: z.optional(
    z.array(z.int().check(z.minimum(0), z.maximum(6))).check(z.minLength(1), z.maxLength(7))
  ),
});

export type NotificationRules = z.infer<typeof NotificationRules>;
export type ItemsRules = z.infer<typeof ItemsRules>;
export type RecurrenceMode = ItemsRules["recurrenceMode"];
export type McpRules = z.infer<typeof McpRules>;
export type PersonalityRules = z.infer<typeof PersonalityRules>;
export type RecurringConfig = z.infer<typeof RecurringConfig>;

// V2: BucketSchema — fields, statuses, notification triggers

export const FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "currency",
  "boolean",
  "date",
  "datetime",
  "url",
  "select",
  "multiselect",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export const FieldValidation = z.object({
  required: z.optional(z.boolean()),
  min: z.optional(z.number()),
  max: z.optional(z.number()),
  minLength: z.optional(z.int().check(z.nonnegative())),
  maxLength: z.optional(z.int().check(z.nonnegative())),
  pattern: z.optional(z.string()),
});

export const FieldDef = z.object({
  key: z.string().check(z.minLength(1), z.maxLength(100)),
  label: z.string().check(z.minLength(1), z.maxLength(100)),
  type: z.enum(FIELD_TYPES),
  options: z.optional(z.array(z.string())),
  currency: z.optional(z.string()),
  showInRow: z.optional(z.boolean()),
  icon: z.optional(z.string()),
  validation: z.optional(FieldValidation),
});

export type StatusDef = {
  name: string;
  color: string;
  isDefault?: boolean;
};

export const BucketSchema = z.object({
  fields: z._default(z.array(FieldDef), []),
  notifyOnArrival: z.optional(z.boolean()),
  notifyWhenOverdue: z.optional(z.boolean()),
  overdueRepeatHours: z.optional(z.number().check(z.positive())),
  overdueFirstAlertMins: z.optional(z.int().check(z.positive())),
});

export type FieldValidation = z.infer<typeof FieldValidation>;
export type FieldDef = z.infer<typeof FieldDef>;
export type BucketSchema = z.infer<typeof BucketSchema>;

/**
 * Generates a Zod validator for item properties based on a bucket's fieldSchema.
 * Used by the webhook endpoint and item creation to validate dynamic field values.
 */
export function buildPropertyValidator(
  fields: FieldDef[]
): z.ZodMiniObject<Record<string, z.ZodMiniType>> {
  const shape: Record<string, z.ZodMiniType> = {};

  for (const field of fields) {
    const validation = field.validation;
    let base: z.ZodMiniType;

    switch (field.type) {
      case "text":
      case "textarea": {
        const checks: z.core.$ZodCheck<string>[] = [];
        if (validation?.minLength !== undefined) checks.push(z.minLength(validation.minLength));
        if (validation?.maxLength !== undefined) checks.push(z.maxLength(validation.maxLength));
        if (validation?.pattern !== undefined) checks.push(z.regex(new RegExp(validation.pattern)));
        base = z.string().check(...checks);
        break;
      }
      case "url":
        base = z.url();
        break;
      case "number":
      case "currency": {
        const checks: z.core.$ZodCheck<number>[] =
          field.type === "currency" ? [z.nonnegative()] : [];
        if (validation?.min !== undefined) checks.push(z.minimum(validation.min));
        if (validation?.max !== undefined) checks.push(z.maximum(validation.max));
        base = z.number().check(...checks);
        break;
      }
      case "boolean":
        base = z.boolean();
        break;
      case "date":
        base = z.iso.date();
        break;
      case "datetime":
        base = z.iso.datetime();
        break;
      case "select": {
        const opts = field.options ?? [];
        base = opts.length > 0 ? z.enum(opts as [string, ...string[]]) : z.string();
        break;
      }
      case "multiselect": {
        const opts = field.options ?? [];
        const itemValidator = opts.length > 0 ? z.enum(opts as [string, ...string[]]) : z.string();
        base = z.array(itemValidator);
        break;
      }
      default:
        base = z.unknown();
    }

    shape[field.key] = validation?.required ? base : z.nullable(z.optional(base));
  }

  return z.object(shape);
}

import { z } from "zod";

export const NotificationRules = z.object({
  medium: z.array(z.enum(["ntfy", "email", "telegram"])).default([]),
  notifyAt: z.string().default(""),
  quietHours: z.object({ from: z.string(), to: z.string() }).nullable().default(null),
  defaultOffsetMins: z.number().int().nonnegative().default(0),
  repeat: z.enum(["once", "daily"]).default("once"),
});

export const ItemsRules = z.object({
  sortBy: z.enum(["deadline", "created_at", "manual"]).default("deadline"),
  drag: z.boolean().default(false),
  readonly: z.boolean().default(false),
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
  required: z.boolean().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  minLength: z.number().int().nonnegative().optional(),
  maxLength: z.number().int().nonnegative().optional(),
  pattern: z.string().optional(),
});

export const FieldDef = z.object({
  key: z.string().min(1).max(100),
  label: z.string().min(1).max(100),
  type: z.enum(FIELD_TYPES),
  options: z.array(z.string()).optional(),
  currency: z.string().optional(),
  showInRow: z.boolean().optional(),
  icon: z.string().optional(),
  validation: FieldValidation.optional(),
});

export type StatusDef = {
  name: string;
  color: string;
  isDefault?: boolean;
};

export const BucketSchema = z.object({
  fields: z.array(FieldDef).default([]),
  notifyOnArrival: z.boolean().optional(),
  notifyWhenOverdue: z.boolean().optional(),
  overdueRepeatHours: z.number().positive().optional(),
  overdueFirstAlertMins: z.number().int().positive().optional(),
});

export type FieldValidation = z.infer<typeof FieldValidation>;
export type FieldDef = z.infer<typeof FieldDef>;
export type BucketSchema = z.infer<typeof BucketSchema>;

/**
 * Generates a Zod validator for item properties based on a bucket's fieldSchema.
 * Used by the webhook endpoint and item creation to validate dynamic field values.
 */
export function buildPropertyValidator(fields: FieldDef[]): z.ZodObject<Record<string, z.ZodType>> {
  const shape: Record<string, z.ZodType> = {};

  for (const field of fields) {
    let base: z.ZodType;

    switch (field.type) {
      case "text":
      case "textarea": {
        let v = z.string();
        if (field.validation?.minLength !== undefined) v = v.min(field.validation.minLength);
        if (field.validation?.maxLength !== undefined) v = v.max(field.validation.maxLength);
        if (field.validation?.pattern !== undefined)
          v = v.regex(new RegExp(field.validation.pattern));
        base = v;
        break;
      }
      case "url":
        base = z.url();
        break;
      case "number": {
        let v = z.number();
        if (field.validation?.min !== undefined) v = v.min(field.validation.min);
        if (field.validation?.max !== undefined) v = v.max(field.validation.max);
        base = v;
        break;
      }
      case "currency": {
        let v = z.number().nonnegative();
        if (field.validation?.min !== undefined) v = v.min(field.validation.min);
        if (field.validation?.max !== undefined) v = v.max(field.validation.max);
        base = v;
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

    shape[field.key] = field.validation?.required ? base : base.optional().nullable();
  }

  return z.object(shape);
}

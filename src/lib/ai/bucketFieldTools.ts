import { revalidatePath } from "next/cache";
import { findAccessibleBucket } from "@/lib/buckets/access";
import { checkFields, fieldKey, type FieldsCheck } from "@/lib/buckets/field-schema";
import { saveBucketFields } from "@/lib/buckets/save-fields";
import { CURRENCY_OPTIONS } from "@/components/buckets/constants";
import { FIELD_TYPES, type FieldDef } from "@/types/rules";
import { parseFields } from "@/components/buckets/fields";
import type { Tool } from "./types";

const FIELD_INPUT = {
  type: "object",
  properties: {
    key: {
      type: "string",
      description:
        "Only to keep an existing field: its current key, so items keep their values. Leave out for a new field.",
    },
    label: { type: "string", description: "What the user sees, e.g. 'Monthly cost'." },
    type: {
      type: "string",
      enum: FIELD_TYPES,
      description:
        "text, textarea (long text), number, currency (an amount), boolean (yes / no), date, datetime, url, select (one of options), multiselect (any of options).",
    },
    options: {
      type: "array",
      items: { type: "string" },
      description: "The choices, needed for select and multiselect.",
    },
    currency: {
      type: "string",
      enum: CURRENCY_OPTIONS.map((c) => c.value),
      description: "For currency fields.",
    },
    required: { type: "boolean", description: "Every item must have a value." },
    show_in_row: {
      type: "boolean",
      description: "Show the value on the item's row in the list (default true).",
    },
    min: { type: "number", description: "Lowest allowed number, for number and currency." },
    max: { type: "number", description: "Highest allowed number, for number and currency." },
  },
  required: ["label", "type"],
};

export const FIELDS_PARAMETER = {
  type: "array",
  items: FIELD_INPUT,
  description:
    "Custom fields every item in the bucket has, beyond title, date, repeat and reminders. " +
    "Only add fields the user asked for or that the bucket clearly needs (a price for subscriptions, a link for reading).",
};

export const BUCKET_FIELD_TOOLS: Tool[] = [
  {
    name: "update_bucket_fields",
    description:
      "Set a bucket's custom fields: the list given replaces the current one. " +
      "To keep a field pass it with its key from the bucket's fields line; to change it pass the same key with only what changes (label, type, options, required, ...), the rest stays. " +
      "A field left out is removed from the bucket; its values stay on items but are hidden, and come back if a field with that key returns. " +
      "Before removing a field, tell the user and ask. Only the bucket's owner can change its fields.",
    parameters: {
      type: "object",
      properties: {
        bucket_id: { type: "number", description: "The bucket's ID." },
        fields: FIELDS_PARAMETER,
      },
      required: ["bucket_id", "fields"],
    },
  },
];

// A field given with an existing key changes only what's given, so nothing it leaves out is lost
function toFieldDef(raw: unknown, existing: FieldDef[]): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const f = raw as Record<string, unknown>;
  const key = typeof f.key === "string" ? f.key.trim() : "";
  const kept = key ? existing.find((e) => e.key === key) : undefined;
  const label = typeof f.label === "string" && f.label.trim() ? f.label.trim() : kept?.label;
  const validation = {
    ...kept?.validation,
    ...(typeof f.required === "boolean" && { required: f.required }),
    ...(typeof f.min === "number" && { min: f.min }),
    ...(typeof f.max === "number" && { max: f.max }),
  };
  const options = Array.isArray(f.options) ? f.options.map(String) : kept?.options;
  const currency = typeof f.currency === "string" ? f.currency : kept?.currency;
  return {
    ...kept,
    key: key || fieldKey(label ?? ""),
    label,
    type: f.type ?? kept?.type,
    ...(options && { options }),
    ...(currency && { currency }),
    showInRow: typeof f.show_in_row === "boolean" ? f.show_in_row : (kept?.showInRow ?? true),
    ...(Object.keys(validation).length > 0 && { validation }),
  };
}

export function fieldsFromArgs(raw: unknown, existing: FieldDef[] = []): FieldsCheck {
  if (!Array.isArray(raw)) return { ok: false, error: "fields must be a list" };
  return checkFields(raw.map((f) => toFieldDef(f, existing)));
}

function removedLabels(before: FieldDef[], after: FieldDef[]): string[] {
  const kept = new Set(after.map((f) => f.key));
  return before.filter((f) => !kept.has(f.key)).map((f) => f.label);
}

export async function executeBucketFieldTool(
  name: string,
  args: Record<string, unknown>,
  userId: number
): Promise<string | null> {
  if (name !== "update_bucket_fields") return null;

  const bucket = await findAccessibleBucket(userId, Number(args.bucket_id));
  if (!bucket || bucket.deletedAt) return JSON.stringify({ ok: false, error: "Bucket not found" });
  if (bucket.userId !== userId) {
    return JSON.stringify({
      ok: false,
      error: "Only the bucket's owner can change its fields. Tell the user to ask them.",
    });
  }

  const existing = parseFields(bucket.fieldSchema);
  const checked = fieldsFromArgs(args.fields, existing);
  if (!checked.ok) return JSON.stringify({ ok: false, error: checked.error });
  const removed = removedLabels(existing, checked.fields);
  await saveBucketFields(bucket, checked.fields);

  revalidatePath("/");
  return JSON.stringify({ ok: true, fields: checked.fields, removed });
}

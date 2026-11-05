import { BucketSchema, buildPropertyValidator, type FieldDef } from "@/types/rules";

export function fieldKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export type FieldsCheck = { ok: true; fields: FieldDef[] } | { ok: false; error: string };

export function checkFields(input: unknown): FieldsCheck {
  const parsed = BucketSchema.safeParse({ fields: input });
  if (!parsed.success) return { ok: false, error: "Invalid field definitions" };
  const fields = parsed.data.fields;

  const seen = new Set<string>();
  for (const field of fields) {
    if (!field.key.trim()) return { ok: false, error: `"${field.label}" needs a key` };
    if (seen.has(field.key)) return { ok: false, error: `Two fields share the key "${field.key}"` };
    seen.add(field.key);
    if ((field.type === "select" || field.type === "multiselect") && !field.options?.length) {
      return { ok: false, error: `"${field.label}" is a choice field and needs options` };
    }
  }

  try {
    buildPropertyValidator(fields);
  } catch {
    return { ok: false, error: "Invalid field definitions" };
  }
  return { ok: true, fields };
}

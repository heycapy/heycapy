import { BucketSchema, type FieldDef } from "@/types/rules";

export function parseFields(fieldSchema: unknown): FieldDef[] {
  try {
    if (!fieldSchema) return [];
    const raw = fieldSchema as string;
    return BucketSchema.parse(typeof raw === "string" ? JSON.parse(raw) : raw).fields;
  } catch {
    return [];
  }
}

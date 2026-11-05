import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets } from "@/lib/db/schema";
import type { BucketSchema, FieldDef } from "@/types/rules";

function storedSchema(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  try {
    const value = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch (err) {
    process.stderr.write(
      `[field-schema] failed to parse a stored field schema: ${err instanceof Error ? err.message : String(err)}\n`
    );
    return {};
  }
}

// Replaces the fields only; the overdue and arrival settings kept beside them stay
export async function saveBucketFields(
  bucket: { id: number; userId: number; fieldSchema: unknown },
  fields: FieldDef[]
): Promise<void> {
  const settings = storedSchema(bucket.fieldSchema);
  delete settings.fields;
  await db
    .update(buckets)
    .set({
      fieldSchema: JSON.stringify({ ...settings, fields }) as unknown as BucketSchema,
      updatedAt: new Date(),
    })
    .where(and(eq(buckets.id, bucket.id), eq(buckets.userId, bucket.userId)));
}

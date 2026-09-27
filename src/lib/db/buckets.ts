import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets } from "@/lib/db/schema";

// Case-insensitive, so "Todo" and "todo" count as the same name
export async function findBucketByName(
  userId: number,
  name: string,
  excludeId?: number
): Promise<{ id: number } | null> {
  const [row] = await db
    .select({ id: buckets.id })
    .from(buckets)
    .where(
      and(
        eq(buckets.userId, userId),
        isNull(buckets.deletedAt),
        sql`lower(${buckets.name}) = lower(${name})`,
        excludeId !== undefined ? ne(buckets.id, excludeId) : undefined
      )
    )
    .limit(1);
  return row ?? null;
}

import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, items } from "@/lib/db/schema";
import { ITEM_STATUS, VOICE_HINT_ITEMS, VOICE_HINT_MAX_LENGTH } from "@/constants";

export type VoiceContext = { assistant: string; names: string[] };

// kept short on purpose since a long list makes the model hear names that were not said
export async function voiceContext(userId: number, assistantName: string): Promise<VoiceContext> {
  const [bucketRows, itemRows] = await Promise.all([
    db
      .select({ name: buckets.name })
      .from(buckets)
      .where(and(eq(buckets.userId, userId), isNull(buckets.deletedAt))),
    db
      .select({ title: items.title })
      .from(items)
      .where(
        and(
          eq(items.userId, userId),
          isNull(items.deletedAt),
          inArray(items.status, [ITEM_STATUS.active, ITEM_STATUS.onHold])
        )
      )
      .orderBy(sql`${items.deadline} is null`, asc(items.deadline), desc(items.createdAt))
      .limit(VOICE_HINT_ITEMS),
  ]);

  const assistant = assistantName.trim() || "capy";
  const seen = new Set<string>();
  const names = [
    "capy",
    "hey capy",
    "heycapy",
    assistant,
    `hey ${assistant}`,
    ...bucketRows.map((b) => b.name),
    ...itemRows.map((i) => i.title),
  ]
    .map((n) => n.trim())
    .filter((n) => {
      const key = n.toLowerCase();
      if (!n || n.length > VOICE_HINT_MAX_LENGTH || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return { assistant, names };
}

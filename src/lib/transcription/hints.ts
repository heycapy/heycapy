import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bucketMembers, buckets, items, users } from "@/lib/db/schema";
import { inLiveBucket } from "@/lib/buckets/live";
import { memberBucketIds } from "@/lib/buckets/access";
import { memberName } from "@/lib/buckets/member-name";
import { ITEM_STATUS, VOICE_HINT_ITEMS, VOICE_HINT_MAX_LENGTH } from "@/constants";

export type VoiceContext = { assistant: string; names: string[] };

// kept short on purpose since a long list makes the model hear names that were not said
export async function voiceContext(userId: number, assistantName: string): Promise<VoiceContext> {
  const [bucketRows, memberRows, itemRows] = await Promise.all([
    db
      .select({ name: buckets.name })
      .from(buckets)
      .where(and(inArray(buckets.id, memberBucketIds(userId)), isNull(buckets.deletedAt))),
    // The others in the user's buckets, so "assign it to Sam" is heard right
    db
      .selectDistinct({ username: users.username, displayName: users.displayName })
      .from(bucketMembers)
      .innerJoin(users, eq(users.id, bucketMembers.userId))
      .innerJoin(buckets, eq(buckets.id, bucketMembers.bucketId))
      .where(
        and(
          inArray(bucketMembers.bucketId, memberBucketIds(userId)),
          ne(bucketMembers.userId, userId),
          inLiveBucket
        )
      ),
    db
      .select({ title: items.title })
      .from(items)
      .innerJoin(buckets, eq(buckets.id, items.bucketId))
      .where(
        and(
          inArray(items.bucketId, memberBucketIds(userId)),
          isNull(items.deletedAt),
          inLiveBucket,
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
    ...memberRows.map(memberName),
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

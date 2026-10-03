import { and, asc, eq, isNotNull, isNull, like, lt, notInArray, sql } from "drizzle-orm";
import { CLOSED_ITEM_STATUSES, SEARCH_RESULTS_MAX, TODAY_FETCH_AHEAD_DAYS } from "@/constants";
import { db } from "@/lib/db";
import { buckets, items } from "@/lib/db/schema";
import { inLiveBucket } from "@/lib/buckets/live";
import { getReminderBadges, type ReminderBadge } from "@/lib/reminders/status";
import { parseItemsRules, parseNotificationRules } from "@/lib/rules";

type Item = typeof items.$inferSelect;

export type ItemBucket = {
  id: number;
  name: string;
  icon: string | null;
  fieldSchema: unknown;
  index: number;
  readonly: boolean;
  defaultReminders: number[];
};

export type CrossBucketItems = {
  items: Item[];
  buckets: ItemBucket[];
  reminderBadges: Record<number, ReminderBadge>;
};

async function withBuckets(userId: number, rows: Item[]): Promise<CrossBucketItems> {
  const all = await db
    .select()
    .from(buckets)
    .where(and(eq(buckets.userId, userId), inLiveBucket))
    .orderBy(asc(buckets.sortOrder), asc(buckets.createdAt));
  const used = new Set(rows.map((i) => i.bucketId));
  const badges: Record<number, ReminderBadge> = {};
  for (const bucket of all.filter((b) => used.has(b.id))) {
    Object.assign(
      badges,
      await getReminderBadges(
        userId,
        bucket.notificationsRules,
        rows.filter((i) => i.bucketId === bucket.id)
      )
    );
  }
  return {
    items: rows,
    buckets: all.flatMap((b, index) =>
      used.has(b.id)
        ? [
            {
              id: b.id,
              name: b.name,
              icon: b.icon,
              fieldSchema: b.fieldSchema,
              index,
              readonly: parseItemsRules(b.itemsRules).readonly === true,
              defaultReminders: parseNotificationRules(b.notificationsRules).defaultReminders,
            },
          ]
        : []
    ),
    reminderBadges: badges,
  };
}

export async function listToday(userId: number, now = new Date()): Promise<CrossBucketItems> {
  const until = new Date(now.getTime() + (TODAY_FETCH_AHEAD_DAYS + 1) * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ item: items })
    .from(items)
    .innerJoin(buckets, eq(buckets.id, items.bucketId))
    .where(
      and(
        eq(items.userId, userId),
        isNull(items.deletedAt),
        inLiveBucket,
        isNotNull(items.deadline),
        lt(items.deadline, until),
        notInArray(items.status, [...CLOSED_ITEM_STATUSES])
      )
    )
    .orderBy(asc(items.deadline), asc(items.id));
  return withBuckets(
    userId,
    rows.map((r) => r.item)
  );
}

export async function searchItems(userId: number, query: string): Promise<CrossBucketItems> {
  const term = query.trim();
  if (!term) return { items: [], buckets: [], reminderBadges: {} };
  const pattern = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const rows = await db
    .select({ item: items })
    .from(items)
    .innerJoin(buckets, eq(buckets.id, items.bucketId))
    .where(
      and(
        eq(items.userId, userId),
        isNull(items.deletedAt),
        inLiveBucket,
        notInArray(items.status, [...CLOSED_ITEM_STATUSES]),
        like(items.title, sql`${pattern} escape '\\'`)
      )
    )
    .orderBy(sql`${items.deadline} is null`, asc(items.deadline), asc(items.id))
    .limit(SEARCH_RESULTS_MAX);
  return withBuckets(
    userId,
    rows.map((r) => r.item)
  );
}

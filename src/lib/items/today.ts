import { and, asc, eq, inArray, isNotNull, isNull, like, lt, notInArray, sql } from "drizzle-orm";
import { CLOSED_ITEM_STATUSES, SEARCH_RESULTS_MAX, TODAY_FETCH_AHEAD_DAYS } from "@/constants";
import { db } from "@/lib/db";
import { buckets, items, users } from "@/lib/db/schema";
import { memberBucketIds } from "@/lib/buckets/access";
import { inLiveBucket } from "@/lib/buckets/live";
import {
  getReminderBadges,
  withViewerReminders,
  type ListItem,
  type ReminderBadge,
} from "@/lib/reminders/status";
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

export type ItemPerson = {
  userId: number;
  username: string | null;
  avatar: string | null;
  isYou: boolean;
};

export type CrossBucketItems = {
  items: ListItem[];
  buckets: ItemBucket[];
  reminderBadges: Record<number, ReminderBadge>;
  assignees: Record<number, ItemPerson[]>;
};

// Keyed by item id, in the order they were assigned
async function assigneesOf(
  viewerId: number,
  found: ListItem[]
): Promise<Record<number, ItemPerson[]>> {
  const ids = [...new Set(found.flatMap((i) => i.assigneeIds))];
  if (ids.length === 0) return {};
  const people = await db
    .select({ userId: users.id, username: users.username, avatar: users.avatar })
    .from(users)
    .where(inArray(users.id, ids));
  const result: Record<number, ItemPerson[]> = {};
  for (const item of found) {
    const list = item.assigneeIds.flatMap((id) => {
      const person = people.find((p) => p.userId === id);
      return person ? [{ ...person, isYou: person.userId === viewerId }] : [];
    });
    if (list.length > 0) result[item.id] = list;
  }
  return result;
}

async function withBuckets(userId: number, found: Item[]): Promise<CrossBucketItems> {
  const rows = await withViewerReminders(userId, found);
  const all = await db
    .select()
    .from(buckets)
    .where(and(inArray(buckets.id, memberBucketIds(userId)), inLiveBucket))
    .orderBy(asc(buckets.sortOrder), asc(buckets.createdAt), asc(buckets.id));
  const used = new Set(rows.map((i) => i.bucketId));
  const badges: Record<number, ReminderBadge> = {};
  for (const bucket of all.filter((b) => used.has(b.id))) {
    Object.assign(
      badges,
      await getReminderBadges(
        userId,
        bucket.id,
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
    assignees: await assigneesOf(userId, rows),
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
        inArray(items.bucketId, memberBucketIds(userId)),
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
  if (!term) return { items: [], buckets: [], reminderBadges: {}, assignees: {} };
  const pattern = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const rows = await db
    .select({ item: items })
    .from(items)
    .innerJoin(buckets, eq(buckets.id, items.bucketId))
    .where(
      and(
        inArray(items.bucketId, memberBucketIds(userId)),
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

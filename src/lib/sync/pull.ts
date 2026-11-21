import { and, asc, eq, gt, inArray, lte, or } from "drizzle-orm";
import type { DbHandle } from "@/lib/db/handle";
import {
  bucketMembers,
  buckets,
  itemReminders,
  items,
  syncState,
  syncTombstones,
  users,
} from "@/lib/db/schema";
import { memberBucketIds } from "@/lib/buckets/access";
import { assigneeIdsByItem } from "@/lib/items/assignees";

type Bucket = typeof buckets.$inferSelect;
type Item = typeof items.$inferSelect;

export type PullRecord =
  | { entity: "bucket"; id: number; rev: number; data: BucketData }
  | { entity: "bucket_member"; id: number; rev: number; data: MemberData }
  | { entity: "item"; id: string; rev: number; data: Item & { assigneeIds: number[] } }
  | { entity: "item_reminder"; id: string; rev: number; data: ReminderData };

// What a member's screen needs, named one by one so a column added later is not sent by default:
// the owner's integration settings (Telegram, webhook, MCP) stay on the server
type BucketData = Pick<
  Bucket,
  | "id"
  | "userId"
  | "name"
  | "icon"
  | "color"
  | "notificationsRules"
  | "itemsRules"
  | "personalityRules"
  | "fieldSchema"
  | "isPrivate"
  | "sortOrder"
  | "archivedAt"
  | "deletedAt"
  | "createdAt"
  | "updatedAt"
>;
type MemberData = {
  bucketId: number;
  userId: number;
  role: "owner" | "member";
  sortOrder: number | null;
  // Only your own: where a person's reminders go is theirs
  channels: string | null;
  username: string | null;
  avatar: string | null;
};
type ReminderData = {
  itemId: string;
  notifiedAt: Date | null;
  overdueNotifiedAt: Date | null;
  nextReminderAt: Date | null;
  nextOverdueAt: Date | null;
};

export type PullTombstone = {
  entity: "bucket" | "bucket_member" | "item" | "item_reminder";
  id: string;
  rev: number;
  bucketId: number | null;
  userId: number | null;
};

export type PullResult =
  | { reset: true }
  | {
      reset: false;
      cursor: number;
      more: boolean;
      tombstones: PullTombstone[];
      records: PullRecord[];
    };

// The client applies every tombstone of a page before any record. A page holds the changes in
// revision order, then the older rows of any bucket the person joined in it, so only the order
// "deletes, then upserts" is right whatever the revisions say
export function pull(h: DbHandle, userId: number, cursor: number, limit: number): PullResult {
  const state = h.select().from(syncState).where(eq(syncState.id, 1)).get();
  const current = state?.rev ?? 0;
  if (cursor > current || (cursor > 0 && cursor < (state?.minRev ?? 0))) return { reset: true };

  const mine = memberBucketIds(userId);
  const changes = [
    ...bucketRows(h, and(inArray(buckets.id, mine), gt(buckets.rev, cursor)), limit + 1),
    ...memberRows(
      h,
      userId,
      and(inArray(bucketMembers.bucketId, mine), gt(bucketMembers.rev, cursor)),
      limit + 1
    ),
    ...itemRows(h, and(inArray(items.bucketId, mine), gt(items.rev, cursor)), limit + 1),
    ...reminderRows(
      h,
      userId,
      and(inArray(items.bucketId, mine), gt(itemReminders.rev, cursor)),
      limit + 1
    ),
    ...tombstoneRows(h, userId, cursor, limit + 1),
  ].sort((a, b) => a.rev - b.rev);

  const more = changes.length > limit;
  const page = changes.slice(0, limit);
  const lastRev = page.at(-1)?.rev;
  const next = more && lastRev !== undefined ? lastRev : current;

  const tombstones = page.filter(isTombstone);
  const records = page.filter((c): c is PullRecord => !isTombstone(c));

  const joined = records.flatMap((r) =>
    r.entity === "bucket_member" && r.data.userId === userId ? [r.data.bucketId] : []
  );
  if (joined.length > 0) {
    records.push(
      ...bucketRows(h, and(inArray(buckets.id, joined), lte(buckets.rev, cursor))),
      ...memberRows(
        h,
        userId,
        and(inArray(bucketMembers.bucketId, joined), lte(bucketMembers.rev, cursor))
      ),
      ...itemRows(h, and(inArray(items.bucketId, joined), lte(items.rev, cursor))),
      ...reminderRows(
        h,
        userId,
        and(inArray(items.bucketId, joined), lte(itemReminders.rev, cursor))
      )
    );
  }

  records.push(...remindersOfSentItems(h, userId, records));

  return { reset: false, cursor: next, more, tombstones, records };
}

// A device keeps a reminder only along with its item, so an item that reaches it (a join, a move into
// a bucket it is in) brings the person's own reminder even though that row itself is older
function remindersOfSentItems(h: DbHandle, userId: number, records: PullRecord[]): PullRecord[] {
  const sent = new Set(records.flatMap((r) => (r.entity === "item_reminder" ? [r.id] : [])));
  const itemIds = records.flatMap((r) => (r.entity === "item" && !sent.has(r.id) ? [r.id] : []));
  if (itemIds.length === 0) return [];
  return reminderRows(h, userId, inArray(itemReminders.itemId, itemIds));
}

function isTombstone(change: PullRecord | PullTombstone): change is PullTombstone {
  return !("data" in change);
}

function bucketRows(h: DbHandle, where: ReturnType<typeof and>, limit?: number): PullRecord[] {
  const query = h.select().from(buckets).where(where).orderBy(asc(buckets.rev));
  return (limit ? query.limit(limit) : query).all().map((row) => ({
    entity: "bucket",
    id: row.id,
    rev: row.rev,
    data: {
      id: row.id,
      userId: row.userId,
      name: row.name,
      icon: row.icon,
      color: row.color,
      notificationsRules: row.notificationsRules,
      itemsRules: row.itemsRules,
      personalityRules: row.personalityRules,
      fieldSchema: row.fieldSchema,
      isPrivate: row.isPrivate,
      sortOrder: row.sortOrder,
      archivedAt: row.archivedAt,
      deletedAt: row.deletedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    },
  }));
}

function memberRows(
  h: DbHandle,
  userId: number,
  where: ReturnType<typeof and>,
  limit?: number
): PullRecord[] {
  const query = h
    .select({ member: bucketMembers, username: users.username, avatar: users.avatar })
    .from(bucketMembers)
    .innerJoin(users, eq(users.id, bucketMembers.userId))
    .where(where)
    .orderBy(asc(bucketMembers.rev));
  return (limit ? query.limit(limit) : query).all().map(({ member, username, avatar }) => ({
    entity: "bucket_member",
    id: member.id,
    rev: member.rev,
    data: {
      bucketId: member.bucketId,
      userId: member.userId,
      role: member.role,
      sortOrder: member.sortOrder,
      channels: member.userId === userId ? member.channels : null,
      username,
      avatar,
    },
  }));
}

function itemRows(h: DbHandle, where: ReturnType<typeof and>, limit?: number): PullRecord[] {
  const query = h.select().from(items).where(where).orderBy(asc(items.rev));
  const rows = (limit ? query.limit(limit) : query).all();
  const assignees = assigneeIdsByItem(
    h,
    rows.map((r) => r.id)
  );
  return rows.map((row) => ({
    entity: "item",
    id: row.id,
    rev: row.rev,
    data: { ...row, assigneeIds: assignees.get(row.id) ?? [] },
  }));
}

function reminderRows(
  h: DbHandle,
  userId: number,
  where: ReturnType<typeof and>,
  limit?: number
): PullRecord[] {
  const query = h
    .select({ reminder: itemReminders })
    .from(itemReminders)
    .innerJoin(items, eq(items.id, itemReminders.itemId))
    .where(and(eq(itemReminders.userId, userId), where))
    .orderBy(asc(itemReminders.rev));
  return (limit ? query.limit(limit) : query).all().map(({ reminder }) => ({
    entity: "item_reminder",
    id: reminder.itemId,
    rev: reminder.rev,
    data: {
      itemId: reminder.itemId,
      notifiedAt: reminder.notifiedAt,
      overdueNotifiedAt: reminder.overdueNotifiedAt,
      nextReminderAt: reminder.nextReminderAt,
      nextOverdueAt: reminder.nextOverdueAt,
    },
  }));
}

// Deletes the person may be told of: in a bucket they are in, their own removal from a bucket, and
// their own reminders
function tombstoneRows(
  h: DbHandle,
  userId: number,
  cursor: number,
  limit: number
): PullTombstone[] {
  return h
    .select()
    .from(syncTombstones)
    .where(
      and(
        gt(syncTombstones.rev, cursor),
        or(
          inArray(syncTombstones.bucketId, memberBucketIds(userId)),
          and(eq(syncTombstones.entity, "bucket_member"), eq(syncTombstones.userId, userId)),
          and(eq(syncTombstones.entity, "item_reminder"), eq(syncTombstones.userId, userId))
        )
      )
    )
    .orderBy(asc(syncTombstones.rev))
    .limit(limit)
    .all()
    .map((t) => ({
      entity: t.entity,
      id: t.entityId,
      rev: t.rev,
      bucketId: t.bucketId,
      userId: t.userId,
    }));
}

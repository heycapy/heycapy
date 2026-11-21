import type { ItemId } from "@/types/ids";
import { recordSystemError } from "@/lib/system-errors";
import { memberChannels, parseNotificationRules } from "@/lib/rules";
import { and, asc, eq, gt, inArray, max, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { DbHandle } from "@/lib/db/handle";
import {
  bucketMembers,
  buckets,
  itemAssignees,
  itemReminders,
  items,
  userSettings,
} from "@/lib/db/schema";
import { memberBucketIds } from "@/lib/buckets/access";
import { NotificationRules } from "@/types/rules";
import { errorMessage } from "@/lib/errors";
import { bucketsChanged } from "@/lib/events";
import { RECONCILE_BATCH_SIZE } from "./constants";
import { nextDeadlineReminder, nextOverdueAlert, type ReminderInputs } from "./schedule";

export const ownerMember = alias(bucketMembers, "owner_member");

export const reminderRowFields = {
  item: items,
  reminder: itemReminders,
  bucketOwnerId: buckets.userId,
  notificationsRules: buckets.notificationsRules,
  channels: bucketMembers.channels,
  ownerChannels: ownerMember.channels,
  firstRecipientId: sql<number>`(select min(r.user_id) from item_reminders r where r.item_id = ${items.id})`,
  ownerIsRecipient: sql<number>`exists(select 1 from item_reminders r where r.item_id = ${items.id} and r.user_id = ${buckets.userId})`,
  fieldSchema: buckets.fieldSchema,
  bucketDeletedAt: buckets.deletedAt,
  bucketArchivedAt: buckets.archivedAt,
  timezone: userSettings.timezone,
  quietFrom: userSettings.quietHoursFrom,
  quietTo: userSettings.quietHoursTo,
};

export type ReminderRow = {
  item: typeof items.$inferSelect;
  reminder: typeof itemReminders.$inferSelect;
  bucketOwnerId: number;
  notificationsRules: string;
  channels: string | null;
  ownerChannels: string | null;
  firstRecipientId: number;
  ownerIsRecipient: number;
  fieldSchema: unknown;
  bucketDeletedAt: Date | null;
  bucketArchivedAt: Date | null;
  timezone: string | null;
  quietFrom: string | null;
  quietTo: string | null;
};

export const recipientMember = and(
  eq(bucketMembers.bucketId, items.bucketId),
  eq(bucketMembers.userId, itemReminders.userId)
);
export const bucketOwnerMember = and(
  eq(ownerMember.bucketId, buckets.id),
  eq(ownerMember.userId, buckets.userId)
);

// One row per item and person reminded, with that person's clock, quiet hours and channels
export function selectReminderRows(h: DbHandle, where: SQL | undefined) {
  return h
    .select(reminderRowFields)
    .from(itemReminders)
    .innerJoin(items, eq(itemReminders.itemId, items.id))
    .innerJoin(buckets, eq(items.bucketId, buckets.id))
    .leftJoin(bucketMembers, recipientMember)
    .leftJoin(ownerMember, bucketOwnerMember)
    .leftJoin(userSettings, eq(userSettings.userId, itemReminders.userId))
    .where(where);
}

function parseTriggers(raw: unknown): {
  notifyWhenOverdue: boolean;
  overdueRepeatHours?: number;
  overdueFirstAlertMins?: number;
} {
  try {
    const parsed = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
    const obj = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    return {
      notifyWhenOverdue: obj.notifyWhenOverdue === true,
      overdueRepeatHours:
        typeof obj.overdueRepeatHours === "number" ? obj.overdueRepeatHours : undefined,
      overdueFirstAlertMins:
        typeof obj.overdueFirstAlertMins === "number" ? obj.overdueFirstAlertMins : undefined,
    };
  } catch {
    return { notifyWhenOverdue: false };
  }
}

export type ReminderContext = { defaultReminders: number[]; notifyAt: string; timezone: string };

// What deadline rules need to know about an item's bucket and its owner
export function reminderContext(h: DbHandle, bucketId: number): ReminderContext {
  const [row] = h
    .select({ rules: buckets.notificationsRules, timezone: userSettings.timezone })
    .from(buckets)
    .leftJoin(userSettings, eq(userSettings.userId, buckets.userId))
    .where(eq(buckets.id, bucketId))
    .limit(1)
    .all();
  const rules = parseNotificationRules(row?.rules);
  return {
    defaultReminders: rules.defaultReminders,
    notifyAt: rules.notifyAt,
    timezone: row?.timezone ?? "UTC",
  };
}

export function userTimezone(h: DbHandle, userId: number): string {
  const [row] = h
    .select({ timezone: userSettings.timezone })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1)
    .all();
  return row?.timezone ?? "UTC";
}

// The owner's webhooks post the bucket's reminders, so when the owner isn't reminded about the item
// they go out once, with the first assignee's
function sharedWebhooks(row: ReminderRow): number[] {
  return !row.ownerIsRecipient && row.firstRecipientId === row.reminder.userId
    ? memberChannels(row.ownerChannels).webhooks
    : [];
}

// Throws on invalid stored rules
export function toReminderInputs(row: ReminderRow): ReminderInputs {
  const triggers = parseTriggers(row.fieldSchema);
  return {
    deadline: row.item.deadline,
    deadlineTimezone: row.item.deadlineTimezone ?? row.timezone ?? "UTC",
    status: row.item.status,
    deletedAt: row.item.deletedAt,
    bucketLive: row.bucketDeletedAt === null && row.bucketArchivedAt === null,
    remindNotBefore: row.item.remindNotBefore,
    notifiedAt: row.reminder.notifiedAt,
    overdueNotifiedAt: row.reminder.overdueNotifiedAt,
    reminderOffsets: row.item.reminderOffsets,
    rules: NotificationRules.parse(JSON.parse(row.notificationsRules)),
    channels: memberChannels(row.channels),
    sharedWebhooks: sharedWebhooks(row),
    notifyWhenOverdue: triggers.notifyWhenOverdue,
    overdueRepeatHours: triggers.overdueRepeatHours,
    overdueFirstAlertMins: triggers.overdueFirstAlertMins,
    timezone: row.timezone ?? "UTC",
    userQuietHours: row.quietFrom && row.quietTo ? { from: row.quietFrom, to: row.quietTo } : null,
  };
}

export function computeSchedule(inputs: ReminderInputs) {
  return { nextReminderAt: nextDeadlineReminder(inputs), nextOverdueAt: nextOverdueAlert(inputs) };
}

const sameTime = (a: Date | null, b: Date | null) =>
  Math.floor((a?.getTime() ?? -1) / 1000) === Math.floor((b?.getTime() ?? -1) / 1000);

function storeSchedules(h: DbHandle, rows: ReminderRow[]): void {
  for (const row of rows) {
    let schedule: { nextReminderAt: Date | null; nextOverdueAt: Date | null };
    try {
      schedule = computeSchedule(toReminderInputs(row));
    } catch (err) {
      recordSystemError(
        "reminders",
        `item ${row.item.id}: invalid notification rules — ${errorMessage(err)}`,
        {
          userId: row.reminder.userId,
          err,
          context: {
            itemId: row.item.id,
            bucketId: row.item.bucketId,
            notificationsRules: row.notificationsRules.slice(0, 500),
          },
        }
      );
      schedule = { nextReminderAt: null, nextOverdueAt: null };
    }
    if (
      sameTime(schedule.nextReminderAt, row.reminder.nextReminderAt) &&
      sameTime(schedule.nextOverdueAt, row.reminder.nextOverdueAt)
    ) {
      continue;
    }
    h.update(itemReminders).set(schedule).where(eq(itemReminders.id, row.reminder.id)).run();
  }
}

const recipientFields = {
  id: items.id,
  bucketId: items.bucketId,
  notifiedAt: items.notifiedAt,
  overdueNotifiedAt: items.overdueNotifiedAt,
};

type RecipientItem = Pick<typeof items.$inferSelect, keyof typeof recipientFields>;

const latest = (dates: (Date | null)[]): Date | null =>
  dates.reduce<Date | null>((a, b) => (b && (!a || b > a) ? b : a), null);

// The assignees still in the bucket, nobody when there are none. Someone added to an item others
// already had skips reminders whose time has passed, so assigning them late doesn't send a burst of
// late ones, and continues its overdue alerts where the others are.
function syncRecipients(h: DbHandle, list: RecipientItem[]): void {
  if (list.length === 0) return;
  const now = new Date();
  const assigned = h
    .select({ itemId: itemAssignees.itemId, userId: itemAssignees.userId })
    .from(itemAssignees)
    .innerJoin(items, eq(items.id, itemAssignees.itemId))
    .innerJoin(
      bucketMembers,
      and(
        eq(bucketMembers.bucketId, items.bucketId),
        eq(bucketMembers.userId, itemAssignees.userId)
      )
    )
    .where(
      inArray(
        itemAssignees.itemId,
        list.map((i) => i.id)
      )
    )
    .all();
  const existing = h
    .select({
      id: itemReminders.id,
      itemId: itemReminders.itemId,
      userId: itemReminders.userId,
      notifiedAt: itemReminders.notifiedAt,
      overdueNotifiedAt: itemReminders.overdueNotifiedAt,
    })
    .from(itemReminders)
    .where(
      inArray(
        itemReminders.itemId,
        list.map((i) => i.id)
      )
    )
    .all();

  const drop: number[] = [];
  const add: (typeof itemReminders.$inferInsert)[] = [];
  for (const item of list) {
    const wanted = assigned.filter((a) => a.itemId === item.id).map((a) => a.userId);
    const have = existing.filter((r) => r.itemId === item.id);
    for (const row of have) if (!wanted.includes(row.userId)) drop.push(row.id);
    for (const userId of wanted) {
      if (have.some((r) => r.userId === userId)) continue;
      add.push({
        itemId: item.id,
        userId,
        notifiedAt: have.length > 0 ? now : item.notifiedAt,
        overdueNotifiedAt: latest([
          item.overdueNotifiedAt,
          ...have.map((r) => r.overdueNotifiedAt),
        ]),
      });
    }
  }
  if (drop.length > 0) h.delete(itemReminders).where(inArray(itemReminders.id, drop)).run();
  if (add.length > 0) h.insert(itemReminders).values(add).onConflictDoNothing().run();
}

function refreshItems(h: DbHandle, list: RecipientItem[]): void {
  syncRecipients(h, list);
  if (list.length === 0) return;
  storeSchedules(
    h,
    selectReminderRows(
      h,
      inArray(
        itemReminders.itemId,
        list.map((i) => i.id)
      )
    ).all()
  );
}

export function refreshItemReminders(h: DbHandle, itemIds: ItemId[]): void {
  if (itemIds.length === 0) return;
  const list = h.select(recipientFields).from(items).where(inArray(items.id, itemIds)).all();
  refreshItems(h, list);
  bucketsChanged(list.map((i) => i.bucketId));
}

export function refreshBucketReminders(h: DbHandle, bucketId: number): void {
  reconcile(h, eq(items.bucketId, bucketId));
  bucketsChanged([bucketId]);
}

export function refreshUserReminders(h: DbHandle, userId: number): void {
  reconcile(h, inArray(items.bucketId, memberBucketIds(userId)));
}

// Safety net for write paths that skip a refresh
export function reconcile(h: DbHandle, where?: SQL): void {
  let lastId = "";
  for (;;) {
    const list = h
      .select(recipientFields)
      .from(items)
      .where(and(gt(items.id, lastId), where))
      .orderBy(asc(items.id))
      .limit(RECONCILE_BATCH_SIZE)
      .all();
    if (list.length === 0) return;
    refreshItems(h, list);
    lastId = list[list.length - 1].id;
  }
}

// When anyone was last reminded about the item
export function lastNotifiedAt(h: DbHandle, itemId: ItemId): Date | null {
  const [row] = h
    .select({ at: max(itemReminders.notifiedAt) })
    .from(itemReminders)
    .where(eq(itemReminders.itemId, itemId))
    .all();
  return row?.at ?? null;
}

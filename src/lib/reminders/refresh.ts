import { recordSystemError } from "@/lib/system-errors";
import { parseNotificationRules } from "@/lib/rules";
import { and, asc, eq, gt, inArray, max, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { bucketMembers, buckets, itemReminders, items, userSettings } from "@/lib/db/schema";
import { memberBucketIds } from "@/lib/buckets/access";
import { NotificationRules } from "@/types/rules";
import { errorMessage } from "@/lib/errors";
import { bucketsChanged } from "@/lib/events";
import { RECONCILE_BATCH_SIZE } from "./constants";
import { nextDeadlineReminder, nextOverdueAlert, type ReminderInputs } from "./schedule";

export const reminderRowFields = {
  item: items,
  reminder: itemReminders,
  bucketOwnerId: buckets.userId,
  notificationsRules: buckets.notificationsRules,
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
  fieldSchema: unknown;
  bucketDeletedAt: Date | null;
  bucketArchivedAt: Date | null;
  timezone: string | null;
  quietFrom: string | null;
  quietTo: string | null;
};

// One row per item and person reminded, with that person's clock and quiet hours
export function selectReminderRows(where: SQL | undefined) {
  return db
    .select(reminderRowFields)
    .from(itemReminders)
    .innerJoin(items, eq(itemReminders.itemId, items.id))
    .innerJoin(buckets, eq(items.bucketId, buckets.id))
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
export async function reminderContext(bucketId: number): Promise<ReminderContext> {
  const [row] = await db
    .select({ rules: buckets.notificationsRules, timezone: userSettings.timezone })
    .from(buckets)
    .leftJoin(userSettings, eq(userSettings.userId, buckets.userId))
    .where(eq(buckets.id, bucketId))
    .limit(1);
  const rules = parseNotificationRules(row?.rules);
  return {
    defaultReminders: rules.defaultReminders,
    notifyAt: rules.notifyAt,
    timezone: row?.timezone ?? "UTC",
  };
}

export async function userTimezone(userId: number): Promise<string> {
  const [row] = await db
    .select({ timezone: userSettings.timezone })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  return row?.timezone ?? "UTC";
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

async function storeSchedules(rows: ReminderRow[]): Promise<void> {
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
    await db.update(itemReminders).set(schedule).where(eq(itemReminders.id, row.reminder.id));
  }
}

const recipientFields = {
  id: items.id,
  bucketId: items.bucketId,
  assigneeId: items.assigneeId,
  notifiedAt: items.notifiedAt,
  overdueNotifiedAt: items.overdueNotifiedAt,
};

type RecipientItem = Pick<typeof items.$inferSelect, keyof typeof recipientFields>;

const latest = (dates: (Date | null)[]): Date | null =>
  dates.reduce<Date | null>((a, b) => (b && (!a || b > a) ? b : a), null);

// The assignee, or every member when nobody is assigned (or the assignee has left). Someone added
// to an item others already had skips reminders whose time has passed, so joining a bucket doesn't
// send a burst of late ones, and continues its overdue alerts where the others are.
async function syncRecipients(list: RecipientItem[]): Promise<void> {
  if (list.length === 0) return;
  const now = new Date();
  const members = await db
    .select({ bucketId: bucketMembers.bucketId, userId: bucketMembers.userId })
    .from(bucketMembers)
    .where(inArray(bucketMembers.bucketId, [...new Set(list.map((i) => i.bucketId))]));
  const existing = await db
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
    );

  const drop: number[] = [];
  const add: (typeof itemReminders.$inferInsert)[] = [];
  for (const item of list) {
    const inBucket = members.filter((m) => m.bucketId === item.bucketId).map((m) => m.userId);
    const wanted =
      item.assigneeId !== null && inBucket.includes(item.assigneeId) ? [item.assigneeId] : inBucket;
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
  if (drop.length > 0) await db.delete(itemReminders).where(inArray(itemReminders.id, drop));
  if (add.length > 0) await db.insert(itemReminders).values(add).onConflictDoNothing();
}

async function refreshItems(list: RecipientItem[]): Promise<void> {
  await syncRecipients(list);
  if (list.length === 0) return;
  await storeSchedules(
    await selectReminderRows(
      inArray(
        itemReminders.itemId,
        list.map((i) => i.id)
      )
    )
  );
}

export async function refreshItemReminders(itemIds: number[]): Promise<void> {
  if (itemIds.length === 0) return;
  const list = await db.select(recipientFields).from(items).where(inArray(items.id, itemIds));
  await refreshItems(list);
  bucketsChanged(list.map((i) => i.bucketId));
}

export async function refreshBucketReminders(bucketId: number): Promise<void> {
  await reconcile(eq(items.bucketId, bucketId));
  bucketsChanged([bucketId]);
}

export async function refreshUserReminders(userId: number): Promise<void> {
  await reconcile(inArray(items.bucketId, memberBucketIds(userId)));
}

// Safety net for write paths that skip a refresh
export async function reconcile(where?: SQL): Promise<void> {
  let lastId = 0;
  for (;;) {
    const list = await db
      .select(recipientFields)
      .from(items)
      .where(and(gt(items.id, lastId), where))
      .orderBy(asc(items.id))
      .limit(RECONCILE_BATCH_SIZE);
    if (list.length === 0) return;
    await refreshItems(list);
    lastId = list[list.length - 1].id;
  }
}

// When anyone was last reminded about the item
export async function lastNotifiedAt(itemId: number): Promise<Date | null> {
  const [row] = await db
    .select({ at: max(itemReminders.notifiedAt) })
    .from(itemReminders)
    .where(eq(itemReminders.itemId, itemId));
  return row?.at ?? null;
}

import { and, asc, eq, gt, inArray, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, items, userSettings } from "@/lib/db/schema";
import { NotificationRules } from "@/types/rules";
import { errorMessage } from "@/lib/errors";
import { RECONCILE_BATCH_SIZE } from "./constants";
import { nextDeadlineReminder, nextOverdueAlert, type ReminderInputs } from "./schedule";

export const reminderRowFields = {
  item: items,
  notificationsRules: buckets.notificationsRules,
  fieldSchema: buckets.fieldSchema,
  timezone: userSettings.timezone,
};

export type ReminderRow = {
  item: typeof items.$inferSelect;
  notificationsRules: string;
  fieldSchema: unknown;
  timezone: string | null;
};

export function selectReminderRows(where: SQL | undefined) {
  return db
    .select(reminderRowFields)
    .from(items)
    .innerJoin(buckets, eq(items.bucketId, buckets.id))
    .leftJoin(userSettings, eq(userSettings.userId, items.userId))
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

export async function bucketDefaultOffsetMins(bucketId: number): Promise<number> {
  const bucket = await db.query.buckets.findFirst({
    where: eq(buckets.id, bucketId),
    columns: { notificationsRules: true },
  });
  if (!bucket) return 0;
  try {
    return NotificationRules.parse(JSON.parse(bucket.notificationsRules)).defaultOffsetMins;
  } catch {
    return 0;
  }
}

// Throws on invalid stored rules
export function toReminderInputs(row: ReminderRow): ReminderInputs {
  const triggers = parseTriggers(row.fieldSchema);
  return {
    deadline: row.item.deadline,
    status: row.item.status,
    deletedAt: row.item.deletedAt,
    remindNotBefore: row.item.remindNotBefore,
    notifiedAt: row.item.notifiedAt,
    overdueNotifiedAt: row.item.overdueNotifiedAt,
    notificationOffsetMins: row.item.notificationOffsetMins,
    rules: NotificationRules.parse(JSON.parse(row.notificationsRules)),
    notifyWhenOverdue: triggers.notifyWhenOverdue,
    overdueRepeatHours: triggers.overdueRepeatHours,
    overdueFirstAlertMins: triggers.overdueFirstAlertMins,
    timezone: row.timezone ?? "UTC",
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
      process.stderr.write(
        `[reminders] item ${row.item.id}: invalid notification rules — ${errorMessage(err)}\n`
      );
      schedule = { nextReminderAt: null, nextOverdueAt: null };
    }
    if (
      sameTime(schedule.nextReminderAt, row.item.nextReminderAt) &&
      sameTime(schedule.nextOverdueAt, row.item.nextOverdueAt)
    ) {
      continue;
    }
    await db.update(items).set(schedule).where(eq(items.id, row.item.id));
  }
}

export async function refreshItemReminders(itemIds: number[]): Promise<void> {
  if (itemIds.length === 0) return;
  await storeSchedules(await selectReminderRows(inArray(items.id, itemIds)));
}

export async function refreshBucketReminders(bucketId: number): Promise<void> {
  await reconcile(eq(items.bucketId, bucketId));
}

export async function refreshUserReminders(userId: number): Promise<void> {
  await reconcile(eq(items.userId, userId));
}

// Safety net for write paths that skip a refresh
export async function reconcile(where?: SQL): Promise<void> {
  let lastId = 0;
  for (;;) {
    const rows = await selectReminderRows(and(gt(items.id, lastId), where))
      .orderBy(asc(items.id))
      .limit(RECONCILE_BATCH_SIZE);
    if (rows.length === 0) return;
    await storeSchedules(rows);
    lastId = rows[rows.length - 1].item.id;
  }
}

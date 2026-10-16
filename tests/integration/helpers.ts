import { vi } from "vitest";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  bucketMembers,
  buckets,
  itemReminders,
  items,
  notificationQueue,
  userSettings,
  users,
} from "@/lib/db/schema";
import { runNotifications } from "@/lib/scheduler";
import { refreshItemReminders } from "@/lib/reminders/refresh";

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
const TELEGRAM_OK = JSON.stringify({ ok: true, result: { message_id: 1 } });

let userCount = 0;

type NotificationRulesInput = {
  medium?: string[];
  webhooks?: number[];
  repeat?: "once" | "daily";
  notifyAt?: string;
  defaultReminders?: number[];
  quietHours?: { from: string; to: string } | null;
  reminderButtons?: string[];
};

// Only telegram is enabled
export async function seedUser(timezone = "UTC"): Promise<number> {
  userCount += 1;
  const [user] = await db
    .insert(users)
    .values({ email: `integration-${userCount}-${Date.now()}@heycapy.test` })
    .returning();
  await db.insert(userSettings).values({
    userId: user.id,
    timezone,
    telegramChatId: "42",
    notificationsTelegram: true,
    notificationsEmail: false,
    notificationsPush: false,
  });
  return user.id;
}

// The channels in `rules` are the owner's own
export async function seedBucket(
  userId: number,
  rules: NotificationRulesInput = { medium: ["telegram"], repeat: "once" },
  fieldSchema?: Record<string, unknown>
): Promise<number> {
  const { medium = [], webhooks = [], ...bucketRules } = rules;
  const [bucket] = await db
    .insert(buckets)
    .values({
      userId,
      name: `Bucket ${Math.random()}`,
      notificationsRules: JSON.stringify(bucketRules),
      ...(fieldSchema && { fieldSchema: JSON.stringify(fieldSchema) as never }),
    })
    .returning();
  await setChannels(userId, bucket.id, medium, webhooks);
  return bucket.id;
}

export async function seedMember(
  bucketId: number,
  userId: number,
  medium: string[] = ["telegram"]
): Promise<void> {
  await db
    .insert(bucketMembers)
    .values({ bucketId, userId, channels: JSON.stringify({ medium, webhooks: [] }) });
}

export async function setChannels(
  userId: number,
  bucketId: number,
  medium: string[],
  webhooks: number[] = []
): Promise<void> {
  await db
    .update(bucketMembers)
    .set({ channels: JSON.stringify({ medium, webhooks }) })
    .where(and(eq(bucketMembers.bucketId, bucketId), eq(bucketMembers.userId, userId)));
}

export async function seedItem(
  userId: number,
  bucketId: number,
  fields: {
    deadline: Date;
    notifiedAt?: Date;
    overdueNotifiedAt?: Date;
    title?: string;
    reminderOffsets?: number[];
  }
): Promise<number> {
  const [item] = await db
    .insert(items)
    .values({
      bucketId,
      userId,
      title: fields.title ?? "pay rent",
      deadline: fields.deadline,
      notifiedAt: fields.notifiedAt ?? null,
      overdueNotifiedAt: fields.overdueNotifiedAt ?? null,
      reminderOffsets: fields.reminderOffsets ?? null,
    })
    .returning();
  await refreshItemReminders([item.id]);
  return item.id;
}

export async function seedReminder(opts: {
  deadline: Date;
  notifiedAt?: Date;
  reminderOffsets?: number[];
}) {
  const userId = await seedUser();
  const bucketId = await seedBucket(userId);
  const itemId = await seedItem(userId, bucketId, opts);
  return { userId, bucketId, itemId };
}

// One person's reminder schedule for the item; without a person, the only one there is
export async function reminderOf(itemId: number, userId?: number) {
  const rows = await db
    .select()
    .from(itemReminders)
    .where(
      and(
        eq(itemReminders.itemId, itemId),
        userId === undefined ? undefined : eq(itemReminders.userId, userId)
      )
    );
  if (rows.length !== 1) {
    throw new Error(`item ${itemId}: expected one reminder schedule, found ${rows.length}`);
  }
  return rows[0];
}

export async function remindersQueued(itemId: number): Promise<number> {
  const rows = await db
    .select()
    .from(notificationQueue)
    .where(and(eq(notificationQueue.itemId, itemId), ne(notificationQueue.status, "skipped")));
  return rows.length;
}

export async function runSchedulerAt(time: Date): Promise<void> {
  vi.setSystemTime(time);
  await runNotifications();
}

export function useSchedulerEnvironment(start: Date): void {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(start);
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(TELEGRAM_OK, { status: 200 }))
  );
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
}

export function resetSchedulerEnvironment(): void {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
}

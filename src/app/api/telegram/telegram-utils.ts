import { ITEM_STATUS } from "@/constants";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, items, userSettings } from "@/lib/db/schema";
import { initialReminderState, reminderResetForDeadline } from "@/lib/items/reminders";
import { refreshItemReminders, reminderContext } from "@/lib/reminders/refresh";
import { createNextOccurrence } from "@/lib/items/recurrence";
import {
  addLocalDays,
  atLocalClock,
  fromLocal,
  parseLocalDateTime,
  toLocal,
} from "@/lib/reminders/zoned";
import type { TelegramBotConfig } from "@/components/buckets/constants";
import { DEFAULT_TELEGRAM_BOT_CONFIG } from "@/components/buckets/constants";

export type TelegramUpdate = {
  message?: { text?: string; chat?: { id: number } };
  callback_query?: {
    id: string;
    data?: string;
    message?: { message_id?: number; chat?: { id: number } };
  };
};

export type RescheduleState = {
  s: "rs";
  itemId: number;
  origin: "reminder" | "list";
  date?: string;
  month?: string;
  typing?: boolean;
  pending?: { hour: number; minute: number };
};

export type FlowState =
  | { s: "title"; bucketId: number; bucketName: string }
  | { s: "deadline"; bucketId: number; bucketName: string; title: string }
  | {
      s: "time";
      bucketId: number;
      bucketName: string;
      title: string;
      date: string;
      isToday: boolean;
    }
  | { s: "ctime"; bucketId: number; bucketName: string; title: string; date: string }
  | { s: "cal"; bucketId: number; bucketName: string; title: string; month: string }
  | { s: "repeat"; bucketId: number; bucketName: string; title: string; deadline: string | null }
  | {
      s: "ctime_ampm";
      bucketId: number;
      bucketName: string;
      title: string;
      date: string;
      hour: number;
      minute: number;
    }
  // list / item management flow
  | { s: "mg_edit"; itemId: number; itemTitle: string; bucketId: number; bucketName: string }
  | { s: "mg_confirm"; itemId: number; itemTitle: string; bucketId: number; bucketName: string }
  | { s: "mg_edit_title"; itemId: number; itemTitle: string; bucketId: number; bucketName: string }
  | RescheduleState
  | null;

export function getFlowState(raw: string | null): FlowState {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FlowState;
  } catch {
    return null;
  }
}

export function getFlowMessageId(raw: string | null): number | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const mid = parsed._mid;
    return typeof mid === "number" ? mid : null;
  } catch {
    return null;
  }
}

export async function setFlowState(
  userId: number,
  state: FlowState,
  messageId?: number | null
): Promise<void> {
  const value = state
    ? messageId
      ? JSON.stringify({ ...state, _mid: messageId })
      : JSON.stringify(state)
    : messageId
      ? JSON.stringify({ _mid: messageId })
      : null;
  await db
    .update(userSettings)
    .set({ telegramState: value })
    .where(eq(userSettings.userId, userId));
}

export function normalizeTelegramConfig(raw: Partial<TelegramBotConfig>): TelegramBotConfig {
  const merged = { ...DEFAULT_TELEGRAM_BOT_CONFIG, ...raw };
  merged.timeSlots = (merged.timeSlots as (string | number)[]).map((s) =>
    typeof s === "number" ? `${String(s).padStart(2, "0")}:00` : s
  );
  return merged;
}

export async function getBucketTelegramConfig(bucketId: number): Promise<TelegramBotConfig> {
  const bucket = await db.query.buckets.findFirst({
    where: (b, { eq: qeq }) => qeq(b.id, bucketId),
  });
  if (!bucket?.telegramConfig) return DEFAULT_TELEGRAM_BOT_CONFIG;
  try {
    return normalizeTelegramConfig(JSON.parse(bucket.telegramConfig) as Partial<TelegramBotConfig>);
  } catch {
    return DEFAULT_TELEGRAM_BOT_CONFIG;
  }
}

export function parseTimeStringExtended(
  input: string
): { hour: number; minute: number; ambiguous: boolean } | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, "");
  const ampmMatch = s.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1] ?? "0");
    const m = parseInt(ampmMatch[2] ?? "0");
    const period = ampmMatch[3];
    if (period === "pm" && h !== 12) h += 12;
    if (period === "am" && h === 12) h = 0;
    if (h >= 0 && h < 24 && m >= 0 && m < 60) return { hour: h, minute: m, ambiguous: false };
  }
  const plainMatch = s.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (plainMatch) {
    const h = parseInt(plainMatch[1] ?? "0");
    const m = parseInt(plainMatch[2] ?? "0");
    if (h >= 0 && h < 24 && m >= 0 && m < 60) {
      // 1–11: ambiguous (could be AM or PM), 0/12–23: unambiguous
      return { hour: h, minute: m, ambiguous: h >= 1 && h <= 11 };
    }
  }
  return null;
}

export function parseNaturalDeadline(input: string, timezone: string): Date | null {
  const s = input.trim().toLowerCase();
  const now = new Date();

  // A date without a time is an all-day item
  const allDay = (offsetDays = 0): Date =>
    addLocalDays(atLocalClock(now, 0, timezone), offsetDays, timezone);

  if (s === "today") return allDay(0);
  if (s === "tomorrow") return allDay(1);
  if (s === "next week") return allDay(7);

  const inMatch = s.match(/^in (\d+) (days?|weeks?|months?)$/);
  if (inMatch) {
    const n = Number(inMatch[1]);
    const unit = inMatch[2] ?? "";
    if (unit.startsWith("day")) return allDay(n);
    if (unit.startsWith("week")) return allDay(n * 7);
    if (unit.startsWith("month")) {
      const today = toLocal(allDay(0), timezone);
      return fromLocal({ ...today, month: today.month + n }, timezone);
    }
  }

  const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayMatch = s.match(/^(?:next )?([a-z]+day)$/);
  if (dayMatch) {
    const target = weekdays.indexOf(dayMatch[1] ?? "");
    if (target !== -1) {
      const todayName = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long" })
        .format(now)
        .toLowerCase();
      const current = weekdays.indexOf(todayName);
      let diff = target - current;
      if (diff <= 0) diff += 7;
      return allDay(diff);
    }
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return parseLocalDateTime(s, timezone);

  const MONTHS = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  const mdMatch = s.match(/^([a-z]+) (\d{1,2})$/) ?? s.match(/^(\d{1,2}) ([a-z]+)$/);
  if (mdMatch) {
    const [, a, b] = mdMatch;
    const [monthStr, dayStr] = /^\d/.test(a ?? "") ? [b ?? "", a ?? ""] : [a ?? "", b ?? ""];
    const mi = MONTHS.indexOf(monthStr.slice(0, 3));
    if (mi !== -1) {
      const day = Number(dayStr);
      const y = now.getFullYear();
      const pad = (n: number) => String(n).padStart(2, "0");
      let d = parseLocalDateTime(`${y}-${pad(mi + 1)}-${pad(day)}`, timezone);
      if (d.getTime() < now.getTime())
        d = parseLocalDateTime(`${y + 1}-${pad(mi + 1)}-${pad(day)}`, timezone);
      return d;
    }
  }

  return null;
}

export async function getUserBuckets(userId: number) {
  return db
    .select({ id: buckets.id, name: buckets.name, icon: buckets.icon })
    .from(buckets)
    .where(and(eq(buckets.userId, userId), isNull(buckets.deletedAt), isNull(buckets.archivedAt)))
    .orderBy(buckets.sortOrder);
}

export async function completeItemById(userId: number, itemId: number): Promise<void> {
  await db
    .update(items)
    .set({ status: ITEM_STATUS.completed, completedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(items.id, itemId), eq(items.userId, userId)));
  await refreshItemReminders([itemId]);
  await createNextOccurrence(itemId);
}

export async function updateItemTitle(
  userId: number,
  itemId: number,
  title: string
): Promise<void> {
  await db
    .update(items)
    .set({ title, updatedAt: new Date() })
    .where(and(eq(items.id, itemId), eq(items.userId, userId)));
}

export async function updateItemDeadline(
  userId: number,
  itemId: number,
  deadline: Date | null
): Promise<void> {
  const item = await db.query.items.findFirst({
    where: and(eq(items.id, itemId), eq(items.userId, userId)),
    columns: { deadline: true, notifiedAt: true, notificationOffsetMins: true, bucketId: true },
  });
  if (!item) return;
  const ctx = await reminderContext(item.bucketId);
  await db
    .update(items)
    .set({
      deadline,
      ...reminderResetForDeadline(item, deadline, ctx),
      updatedAt: new Date(),
    })
    .where(and(eq(items.id, itemId), eq(items.userId, userId)));
  await refreshItemReminders([itemId]);
}

export async function softDeleteItemById(userId: number, itemId: number): Promise<void> {
  await db
    .update(items)
    .set({ deletedAt: new Date() })
    .where(and(eq(items.id, itemId), eq(items.userId, userId)));
  await refreshItemReminders([itemId]);
}

export async function createItem(
  userId: number,
  bucketId: number,
  title: string,
  deadline: Date | null,
  recurring: string | null = null
): Promise<void> {
  const [maxRow] = await db
    .select({ max: sql<number>`COALESCE(MAX(${items.sortOrder}), -1)` })
    .from(items)
    .where(eq(items.bucketId, bucketId));

  const [created] = await db
    .insert(items)
    .values({
      bucketId,
      userId,
      title,
      deadline,
      ...initialReminderState(deadline, (await reminderContext(bucketId)).timezone),
      status: ITEM_STATUS.active,
      source: "manual",
      sortOrder: (maxRow?.max ?? -1) + 1,
      recurring,
    })
    .returning({ id: items.id });
  if (created) await refreshItemReminders([created.id]);
}

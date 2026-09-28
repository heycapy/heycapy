import { ITEM_STATUS } from "@/constants";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { itemActions, items, userSettings } from "@/lib/db/schema";
import { dataEvents } from "@/lib/events";
import { formatWhen } from "@/lib/format-date";
import { syncTelegramReminder } from "@/lib/notifications/telegram-sync";
import { createNextOccurrence } from "@/lib/items/recurrence";
import type { QuickRemindChoice } from "@/lib/notifications/constants";
import { refreshItemReminders, selectReminderRows, toReminderInputs } from "./refresh";
import type { ReminderActionClaim } from "./action-token";
import { nextDeadlineReminder, nextOverdueAlert, remindAgainAt } from "./schedule";
import { addLocalDays } from "./zoned";

export type ActionSource = (typeof itemActions.$inferInsert)["source"];

function record(
  userId: number,
  itemId: number,
  action: (typeof itemActions.$inferInsert)["action"],
  source: ActionSource,
  now: Date,
  remindAt: Date | null = null
) {
  return db
    .insert(itemActions)
    .values({ userId, itemId, action, source, remindAt, createdAt: now });
}

export async function completeItem(
  userId: number,
  itemId: number,
  source: ActionSource,
  now = new Date()
): Promise<void> {
  await db
    .update(items)
    .set({ status: ITEM_STATUS.completed, completedAt: now, updatedAt: now })
    .where(and(eq(items.id, itemId), eq(items.userId, userId)));
  await record(userId, itemId, "done", source, now);
  await refreshItemReminders([itemId]);
  await createNextOccurrence(itemId);
}

// Returns when the next ping will actually go out, or null if the item is gone
export async function remindItemAgain(
  userId: number,
  itemId: number,
  choice: QuickRemindChoice,
  timezone: string,
  source: ActionSource,
  now = new Date()
): Promise<Date | null> {
  const at =
    choice === "tomorrow"
      ? addLocalDays(now, 1, timezone)
      : new Date(now.getTime() + Number(choice) * 60_000);
  const [row] = await selectReminderRows(and(eq(items.id, itemId), eq(items.userId, userId)));
  if (!row) return null;
  await db
    .update(items)
    .set({ ...remindAgainAt(toReminderInputs(row), at, now), updatedAt: now })
    .where(eq(items.id, itemId));
  await refreshItemReminders([itemId]);

  // Quiet hours or "notify at" can push the ping later than asked
  const refreshed = await db.query.items.findFirst({ where: eq(items.id, itemId) });
  const next =
    [refreshed?.nextReminderAt, refreshed?.nextOverdueAt]
      .filter((d): d is Date => d instanceof Date)
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? at;
  await record(userId, itemId, "remindAgain", source, now, next);
  return next;
}

export async function cancelRemindAgain(
  userId: number,
  itemId: number,
  source: ActionSource,
  now = new Date()
): Promise<boolean> {
  const [row] = await selectReminderRows(and(eq(items.id, itemId), eq(items.userId, userId)));
  const remindNotBefore = row?.item.remindNotBefore;
  if (!row || !remindNotBefore || remindNotBefore <= now) return false;
  const without = { ...toReminderInputs(row), remindNotBefore: null };
  const dueNow = (d: Date | null) => d !== null && d.getTime() <= now.getTime();
  await db
    .update(items)
    .set({
      remindNotBefore: null,
      ...(dueNow(nextDeadlineReminder(without)) && { notifiedAt: now }),
      ...(dueNow(nextOverdueAlert(without)) && { overdueNotifiedAt: now }),
      updatedAt: now,
    })
    .where(eq(items.id, itemId));
  await record(userId, itemId, "cancelRemindAgain", source, now);
  await refreshItemReminders([itemId]);
  return true;
}

export type ReminderActionOutcome = {
  ok: boolean;
  message: string;
  bucketId?: number;
};

export async function applyReminderAction(
  claim: ReminderActionClaim,
  now = new Date()
): Promise<ReminderActionOutcome> {
  const [row] = await db
    .select({ item: items, timezone: userSettings.timezone })
    .from(items)
    .innerJoin(userSettings, eq(userSettings.userId, items.userId))
    .where(and(eq(items.id, claim.itemId), eq(items.userId, claim.userId)))
    .limit(1);
  const item = row && !row.item.deletedAt ? row.item : null;
  if (!item) return { ok: false, message: "this item no longer exists" };
  const title = `"${item.title}"`;
  const at = { bucketId: item.bucketId };
  if (item.status === ITEM_STATUS.completed)
    return { ok: true, message: `✓ ${title} is already done`, ...at };
  if (item.status === ITEM_STATUS.missed)
    return { ok: false, message: `${title} was missed — the next one is on its way`, ...at };
  if ((item.deadline?.getTime() ?? null) !== claim.deadline) {
    return { ok: false, message: `this reminder is outdated — ${title} has changed since`, ...at };
  }

  if (claim.action === "done") {
    await completeItem(claim.userId, item.id, claim.channel, now);
    dataEvents.emit("refresh", claim.userId);
    await syncTelegramReminder(claim.userId, item.id, {
      action: "done",
      title: item.title,
      channel: claim.channel,
      now,
      timezone: row?.timezone ?? "UTC",
    });
    return { ok: true, message: `✓ ${title} done`, ...at };
  }
  const timezone = row?.timezone ?? "UTC";
  const next = await remindItemAgain(
    claim.userId,
    item.id,
    claim.action,
    timezone,
    claim.channel,
    now
  );
  dataEvents.emit("refresh", claim.userId);
  if (next) {
    await syncTelegramReminder(claim.userId, item.id, {
      action: "remindAgain",
      at: next,
      title: item.title,
      channel: claim.channel,
      now,
      timezone,
    });
  }
  const when = formatWhen(next ?? now, now, timezone);
  return { ok: true, message: `⏰ ${title} — I'll remind you again ${when}`, ...at };
}

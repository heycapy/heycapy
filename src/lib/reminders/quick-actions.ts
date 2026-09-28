import { ITEM_STATUS } from "@/constants";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { items, userSettings } from "@/lib/db/schema";
import { dataEvents } from "@/lib/events";
import { formatWhen } from "@/lib/format-date";
import { createNextOccurrence } from "@/lib/items/recurrence";
import type { QuickRemindChoice } from "@/lib/notifications/constants";
import { refreshItemReminders, selectReminderRows, toReminderInputs } from "./refresh";
import type { ReminderActionClaim } from "./action-token";
import { remindAgainAt } from "./schedule";
import { addLocalDays } from "./zoned";

export async function completeItem(userId: number, itemId: number): Promise<void> {
  await db
    .update(items)
    .set({ status: ITEM_STATUS.completed, completedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(items.id, itemId), eq(items.userId, userId)));
  await refreshItemReminders([itemId]);
  await createNextOccurrence(itemId);
}

// Returns when the next ping will actually go out, or null if the item is gone
export async function remindItemAgain(
  itemId: number,
  choice: QuickRemindChoice,
  timezone: string,
  now = new Date()
): Promise<Date | null> {
  const at =
    choice === "tomorrow"
      ? addLocalDays(now, 1, timezone)
      : new Date(now.getTime() + Number(choice) * 60_000);
  const [row] = await selectReminderRows(eq(items.id, itemId));
  if (!row) return null;
  await db
    .update(items)
    .set({ ...remindAgainAt(toReminderInputs(row), at, now), updatedAt: now })
    .where(eq(items.id, itemId));
  await refreshItemReminders([itemId]);

  // Quiet hours or "notify at" can push the ping later than asked
  const refreshed = await db.query.items.findFirst({ where: eq(items.id, itemId) });
  const next = [refreshed?.nextReminderAt, refreshed?.nextOverdueAt]
    .filter((d): d is Date => d instanceof Date)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  return next ?? at;
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
    await completeItem(claim.userId, item.id);
    dataEvents.emit("refresh", claim.userId);
    return { ok: true, message: `✓ ${title} done`, ...at };
  }
  const next = await remindItemAgain(item.id, claim.action, row?.timezone ?? "UTC", now);
  dataEvents.emit("refresh", claim.userId);
  const when = formatWhen(next ?? now, now, row?.timezone ?? "UTC");
  return { ok: true, message: `⏰ ${title} — I'll remind you again ${when}`, ...at };
}

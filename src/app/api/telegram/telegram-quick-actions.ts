import { ITEM_STATUS } from "@/constants";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { dataEvents } from "@/lib/events";
import { QUICK_REMIND_OPTIONS, type QuickRemindChoice } from "@/lib/notifications/constants";
import { editTelegramHtml } from "@/lib/notifications/telegram";
import { itemDoneHtml, remindAgainHtml } from "@/lib/notifications/telegram-message";
import {
  refreshItemReminders,
  selectReminderRows,
  toReminderInputs,
} from "@/lib/reminders/refresh";
import { remindAgainAt } from "@/lib/reminders/schedule";
import { addLocalDays } from "@/lib/reminders/zoned";
import { completeItemById } from "./telegram-utils";
import { startReschedule } from "./telegram-reschedule";

type Ctx = { botToken: string; chatId: string; userId: number; timezone: string };

const GONE = "this item no longer exists";

export async function handleReminderAction(
  callbackData: string,
  ctx: Ctx & { alertMessageId: number | undefined }
): Promise<boolean> {
  const [prefix, rawId, choice] = callbackData.split(":");
  const itemId = Number(rawId);
  const messageId = ctx.alertMessageId;
  if (!["qc", "rq", "rs", "qu", "pp"].includes(prefix ?? "")) return false;
  if (!messageId || !Number.isInteger(itemId)) return true;

  // qu: and pp: are older reminder buttons still sitting in chats
  if (prefix === "rs" || prefix === "qu" || prefix === "pp") {
    await startReschedule(ctx, itemId, "reminder", messageId);
    return true;
  }

  const found = await db.query.items.findFirst({
    where: (i, { eq: qeq, and }) => and(qeq(i.id, itemId), qeq(i.userId, ctx.userId)),
  });
  const item = found && !found.deletedAt ? found : null;
  let html: string;
  if (!item) html = GONE;
  else if (item.status === ITEM_STATUS.completed) html = itemDoneHtml(item.title, true);
  else if (prefix === "qc") {
    await completeItemById(ctx.userId, itemId);
    html = itemDoneHtml(item.title, false);
  } else {
    const option = QUICK_REMIND_OPTIONS.find((o) => o.value === choice);
    if (!option) return true;
    html = await remindAgain(ctx, itemId, item.title, option.value);
  }
  if (item) dataEvents.emit("refresh", ctx.userId);
  await editTelegramHtml(ctx.botToken, ctx.chatId, messageId, html);
  return true;
}

async function remindAgain(
  ctx: Ctx,
  itemId: number,
  title: string,
  choice: QuickRemindChoice
): Promise<string> {
  const now = new Date();
  const at =
    choice === "tomorrow"
      ? addLocalDays(now, 1, ctx.timezone)
      : new Date(now.getTime() + Number(choice) * 60_000);
  const [row] = await selectReminderRows(eq(items.id, itemId));
  if (!row) return GONE;
  await db
    .update(items)
    .set({ ...remindAgainAt(toReminderInputs(row), at, now), updatedAt: now })
    .where(eq(items.id, itemId));
  await refreshItemReminders([itemId]);

  // Quiet hours or "notify at" can push the ping later than asked; show the real time
  const refreshed = await db.query.items.findFirst({ where: eq(items.id, itemId) });
  const next = [refreshed?.nextReminderAt, refreshed?.nextOverdueAt]
    .filter((d): d is Date => d instanceof Date)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  return remindAgainHtml(title, next ?? at, now, ctx.timezone);
}

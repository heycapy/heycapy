import { ITEM_STATUS } from "@/constants";
import { db } from "@/lib/db";
import { dataEvents } from "@/lib/events";
import { QUICK_REMIND_OPTIONS, type QuickRemindChoice } from "@/lib/notifications/constants";
import { editTelegramHtml } from "@/lib/notifications/telegram";
import {
  itemDoneHtml,
  itemMissedHtml,
  remindAgainHtml,
} from "@/lib/notifications/telegram-message";
import { completeItem, remindItemAgain } from "@/lib/reminders/quick-actions";
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
  else if (item.status === ITEM_STATUS.missed) html = itemMissedHtml(item.title);
  else if (prefix === "qc") {
    await completeItem(ctx.userId, itemId, "telegram");
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
  const next = await remindItemAgain(ctx.userId, itemId, choice, ctx.timezone, "telegram", now);
  return next ? remindAgainHtml(title, next, now, ctx.timezone) : GONE;
}

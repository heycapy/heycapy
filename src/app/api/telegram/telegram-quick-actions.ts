import { db } from "@/lib/db";
import { dataEvents } from "@/lib/events";
import { postponeDeadline } from "@/lib/items/postpone";
import { POSTPONE_DAYS } from "@/lib/notifications/constants";
import { editTelegramHtml } from "@/lib/notifications/telegram";
import { itemDoneHtml, itemMovedHtml } from "@/lib/notifications/telegram-message";
import { completeItemById, updateItemDeadline } from "./telegram-utils";

type QuickAction = { kind: "done" } | { kind: "postpone"; days: number };

export async function handleReminderAction(
  callbackData: string,
  ctx: {
    botToken: string;
    chatId: string;
    userId: number;
    timezone: string;
    alertMessageId: number | undefined;
  }
): Promise<boolean> {
  const [prefix, rawId, rawDays] = callbackData.split(":");
  const itemId = Number(rawId);
  const days = Number(rawDays);
  let action: QuickAction;
  if (prefix === "qc") action = { kind: "done" };
  else if (prefix === "pp" && POSTPONE_DAYS.some((d) => d === days)) {
    action = { kind: "postpone", days };
  } else return false;

  const found = await db.query.items.findFirst({
    where: (i, { eq, and }) => and(eq(i.id, itemId), eq(i.userId, ctx.userId)),
  });
  const item = found && !found.deletedAt ? found : null;
  const now = new Date();

  let html: string;
  if (!item) html = "this item no longer exists";
  else if (item.status === "completed") html = itemDoneHtml(item.title, true);
  else if (action.kind === "done") {
    await completeItemById(ctx.userId, itemId);
    html = itemDoneHtml(item.title, false);
  } else {
    const deadline = postponeDeadline(item.deadline ?? now, action.days, now, ctx.timezone);
    await updateItemDeadline(ctx.userId, itemId, deadline);
    html = itemMovedHtml(item.title, deadline, now, ctx.timezone);
  }
  if (item) dataEvents.emit("refresh", ctx.userId);

  if (ctx.alertMessageId) {
    await editTelegramHtml(ctx.botToken, ctx.chatId, ctx.alertMessageId, html);
  }
  return true;
}

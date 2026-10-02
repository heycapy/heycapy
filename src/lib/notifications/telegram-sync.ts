import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { notificationQueue, userSettings } from "@/lib/db/schema";
import { isE2ETestMode } from "@/lib/e2e";
import { editTelegramHtml } from "./telegram";
import { itemDoneHtml, remindAgainHtml } from "./telegram-message";

export type ActedFrom = { title: string; channel: string; now: Date; timezone: string } & (
  { action: "done" } | { action: "remindAgain"; at: Date }
);

export async function syncTelegramReminder(
  userId: number,
  itemId: number,
  acted: ActedFrom
): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || isE2ETestMode()) return;
  const [settings] = await db
    .select({ chatId: userSettings.telegramChatId })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  const [last] = await db
    .select({ messageId: notificationQueue.telegramMessageId })
    .from(notificationQueue)
    .where(
      and(eq(notificationQueue.itemId, itemId), isNotNull(notificationQueue.telegramMessageId))
    )
    .orderBy(desc(notificationQueue.id))
    .limit(1);
  if (!settings?.chatId || !last?.messageId) return;

  const html =
    acted.action === "done"
      ? itemDoneHtml(acted.title, false)
      : remindAgainHtml(acted.title, acted.at, acted.now, acted.timezone);
  await editTelegramHtml(
    botToken,
    settings.chatId,
    last.messageId,
    `${html}\n<i>from ${acted.channel}</i>`
  ).catch(() => {});
}

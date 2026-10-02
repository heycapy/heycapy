import { and, desc, eq, isNotNull, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, items, notificationQueue } from "@/lib/db/schema";
import { deleteTelegramMessage, sendTelegram, sendTelegramItemNotification } from "./telegram";
import { itemAlertHtml } from "./telegram-message";
import { bucketReminderButtons } from "@/lib/rules";

type AlertJob = typeof notificationQueue.$inferSelect;

// Returns the sent message id for item alerts so a later overdue alert can replace it
export async function sendTelegramAlert(
  botToken: string,
  chatId: string,
  job: AlertJob,
  opts: { timezone: string; aiNote: boolean; now: Date }
): Promise<number | null> {
  const { itemId, kind } = job;
  const item =
    itemId && (kind === "reminder" || kind === "overdue")
      ? await db
          .select({
            title: items.title,
            deadline: items.deadline,
            bucketName: buckets.name,
            rules: buckets.notificationsRules,
          })
          .from(items)
          .innerJoin(buckets, eq(buckets.id, items.bucketId))
          .where(eq(items.id, itemId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : null;

  if (!itemId || !item?.deadline || (kind !== "reminder" && kind !== "overdue")) {
    await sendTelegram(botToken, chatId, `${job.title}\n${job.message}`);
    return null;
  }

  const html = itemAlertHtml(
    {
      kind,
      title: item.title,
      deadline: item.deadline,
      bucketName: item.bucketName,
      note: kind === "reminder" && opts.aiNote ? job.message : null,
    },
    opts.now,
    opts.timezone
  );
  const messageId = await sendTelegramItemNotification(
    botToken,
    chatId,
    html,
    itemId,
    bucketReminderButtons(item.rules)
  );

  if (kind === "overdue") {
    const [previous] = await db
      .select({ messageId: notificationQueue.telegramMessageId })
      .from(notificationQueue)
      .where(
        and(
          eq(notificationQueue.itemId, itemId),
          eq(notificationQueue.kind, "overdue"),
          isNotNull(notificationQueue.telegramMessageId),
          ne(notificationQueue.id, job.id)
        )
      )
      .orderBy(desc(notificationQueue.id))
      .limit(1);
    if (previous?.messageId) await deleteTelegramMessage(botToken, chatId, previous.messageId);
  }
  return messageId;
}

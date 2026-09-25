import { and, eq, isNull, lte, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { notificationQueue, notificationLog, users, userSettings } from "@/lib/db/schema";
import { sendEmail } from "./email";
import { buildNotificationEmail } from "@/lib/auth/notificationEmail";
import { sendNtfy } from "./ntfy";
import { sendTelegram, sendTelegramItemNotification } from "./telegram";
import { errorMessage } from "@/lib/errors";
import { decryptValue } from "@/lib/crypto";
import {
  QUEUE_DEFAULT_MAX_ATTEMPTS,
  QUEUE_PROCESS_BATCH_SIZE,
  QUEUE_RETRY_DELAY_MINS,
} from "./constants";

export type NotificationMedium = "email" | "ntfy" | "telegram";

export type NotificationJob = {
  userId: number;
  itemId?: number;
  medium: NotificationMedium;
  title: string;
  message: string;
  maxAttempts?: number;
};

export async function enqueue(job: NotificationJob): Promise<void> {
  await db.insert(notificationQueue).values({
    userId: job.userId,
    itemId: job.itemId ?? null,
    medium: job.medium,
    title: job.title,
    message: job.message,
    maxAttempts: job.maxAttempts ?? QUEUE_DEFAULT_MAX_ATTEMPTS,
  });
}

export async function processPending(): Promise<void> {
  const now = new Date();

  const pending = await db
    .select()
    .from(notificationQueue)
    .where(
      and(
        eq(notificationQueue.status, "pending"),
        or(isNull(notificationQueue.nextRetryAt), lte(notificationQueue.nextRetryAt, now))
      )
    )
    .limit(QUEUE_PROCESS_BATCH_SIZE);

  for (const job of pending) {
    await db
      .update(notificationQueue)
      .set({ status: "sending" })
      .where(eq(notificationQueue.id, job.id));

    const userRow = await db
      .select({
        email: users.email,
        notificationsEmail: userSettings.notificationsEmail,
        notificationEmailTo: userSettings.notificationEmailTo,
        notificationsPush: userSettings.notificationsPush,
        ntfyUrl: userSettings.ntfyUrl,
        ntfyTopic: userSettings.ntfyTopic,
        telegramChatId: userSettings.telegramChatId,
        notificationsTelegram: userSettings.notificationsTelegram,
        emailProvider: userSettings.emailProvider,
        smtpHost: userSettings.smtpHost,
        smtpPort: userSettings.smtpPort,
        smtpUser: userSettings.smtpUser,
        smtpPass: userSettings.smtpPass,
        smtpSecure: userSettings.smtpSecure,
        smtpFrom: userSettings.smtpFrom,
      })
      .from(users)
      .innerJoin(userSettings, eq(userSettings.userId, users.id))
      .where(eq(users.id, job.userId))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!userRow) {
      await db
        .update(notificationQueue)
        .set({ status: "dead", lastError: "User not found" })
        .where(eq(notificationQueue.id, job.id));
      continue;
    }

    let deliveryError: string | null = null;

    try {
      switch (job.medium) {
        case "email": {
          if (!userRow.notificationsEmail) throw new Error("Email notifications disabled");
          const userEmailConfig =
            userRow.emailProvider === "smtp" && userRow.smtpHost
              ? {
                  emailProvider: userRow.emailProvider,
                  smtpHost: userRow.smtpHost,
                  smtpPort: userRow.smtpPort,
                  smtpUser: userRow.smtpUser,
                  smtpPass: userRow.smtpPass ? decryptValue(userRow.smtpPass) : null,
                  smtpSecure: userRow.smtpSecure,
                  smtpFrom: userRow.smtpFrom,
                }
              : undefined;
          const { text: emailText, html: emailHtml } = buildNotificationEmail(
            job.title,
            job.message
          );
          await sendEmail(
            {
              to: userRow.notificationEmailTo ?? userRow.email,
              subject: job.title,
              text: emailText,
              html: emailHtml,
            },
            userEmailConfig
          );
          break;
        }
        case "ntfy":
          if (!userRow.notificationsPush || !userRow.ntfyUrl || !userRow.ntfyTopic)
            throw new Error("ntfy not configured");
          await sendNtfy(userRow.ntfyUrl, userRow.ntfyTopic, job.title, job.message);
          break;
        case "telegram": {
          const botToken = process.env.TELEGRAM_BOT_TOKEN;
          if (!userRow.notificationsTelegram || !botToken || !userRow.telegramChatId)
            throw new Error("Telegram not configured");
          if (job.itemId) {
            await sendTelegramItemNotification(
              botToken,
              userRow.telegramChatId,
              job.message,
              job.itemId
            );
          } else {
            await sendTelegram(botToken, userRow.telegramChatId, job.message);
          }
          break;
        }
      }
    } catch (err) {
      deliveryError = errorMessage(err);
    }

    await db.insert(notificationLog).values({
      itemId: job.itemId ?? null,
      userId: job.userId,
      medium: job.medium,
      message: job.message,
      status: deliveryError ? "failed" : "sent",
      error: deliveryError,
    });

    if (!deliveryError) {
      await db
        .update(notificationQueue)
        .set({ status: "sent", sentAt: now })
        .where(eq(notificationQueue.id, job.id));
    } else {
      const newAttempts = job.attempts + 1;
      const isDead = newAttempts >= job.maxAttempts;
      const delayMins = QUEUE_RETRY_DELAY_MINS[job.attempts] ?? 15;
      const nextRetry = isDead ? null : new Date(now.getTime() + delayMins * 60 * 1000);

      await db
        .update(notificationQueue)
        .set({
          status: isDead ? "dead" : "pending",
          attempts: newAttempts,
          nextRetryAt: nextRetry,
          lastError: deliveryError,
        })
        .where(eq(notificationQueue.id, job.id));
    }
  }
}

import { and, eq, inArray, isNull, lte, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { notificationQueue, notificationLog, users, userSettings } from "@/lib/db/schema";
import { sendEmail } from "./email";
import { buildNotificationEmail } from "@/lib/auth/notificationEmail";
import { sendNtfy } from "./ntfy";
import { sendTelegramAlert } from "./telegram-alert";
import { errorMessage } from "@/lib/errors";
import { decryptValue } from "@/lib/crypto";
import { isE2ETestMode } from "@/lib/e2e";
import { dataEvents } from "@/lib/events";
import type { ChannelDecision } from "./channels";
import {
  QUEUE_DEFAULT_MAX_ATTEMPTS,
  QUEUE_PROCESS_BATCH_SIZE,
  QUEUE_RETRY_DELAY_MINS,
  QUEUE_SENDING_LEASE_MS,
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

export async function enqueueNotification(notification: {
  userId: number;
  itemId: number;
  kind: "reminder" | "overdue" | "arrival";
  title: string;
  message: string;
  channels: ChannelDecision[];
}): Promise<void> {
  const createdAt = new Date();
  await db.insert(notificationQueue).values(
    notification.channels.map((c) => ({
      userId: notification.userId,
      itemId: notification.itemId,
      kind: notification.kind,
      medium: c.medium,
      title: notification.title,
      message: notification.message,
      status: c.state === "send" ? ("pending" as const) : ("skipped" as const),
      skipReason: c.state === "send" ? null : c.state,
      createdAt,
    }))
  );
}

export async function processPending(): Promise<void> {
  const now = new Date();

  // Includes abandoned "sending" jobs whose lease expired
  const ready = and(
    inArray(notificationQueue.status, ["pending", "sending"]),
    or(isNull(notificationQueue.nextRetryAt), lte(notificationQueue.nextRetryAt, now))
  );

  const pending = await db
    .select()
    .from(notificationQueue)
    .where(ready)
    .limit(QUEUE_PROCESS_BATCH_SIZE);

  for (const job of pending) {
    // Atomic claim: overlapping runs send each job once
    const [claimed] = await db
      .update(notificationQueue)
      .set({ status: "sending", nextRetryAt: new Date(now.getTime() + QUEUE_SENDING_LEASE_MS) })
      .where(and(eq(notificationQueue.id, job.id), ready))
      .returning({ id: notificationQueue.id });
    if (!claimed) continue;

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
        timezone: userSettings.timezone,
        aiNotifyMessages: userSettings.aiNotifyMessages,
        aiProvider: userSettings.aiProvider,
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

    if (job.itemId) {
      const itemId = job.itemId;
      const itemRow = await db.query.items.findFirst({
        where: (i, { eq: qeq }) => qeq(i.id, itemId),
        columns: { status: true, deletedAt: true },
      });
      if (!itemRow || itemRow.deletedAt || itemRow.status === "completed") {
        await db
          .update(notificationQueue)
          .set({ status: "cancelled" })
          .where(eq(notificationQueue.id, job.id));
        continue;
      }
    }

    if (isE2ETestMode()) {
      // Never deliver during test runs
      await db
        .update(notificationQueue)
        .set({ status: "sent", sentAt: now })
        .where(eq(notificationQueue.id, job.id));
      continue;
    }

    let deliveryError: string | null = null;
    let telegramMessageId: number | null = null;

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
          telegramMessageId = await sendTelegramAlert(botToken, userRow.telegramChatId, job, {
            timezone: userRow.timezone,
            aiNote: userRow.aiNotifyMessages && !!userRow.aiProvider,
            now,
          });
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
        .set({ status: "sent", sentAt: now, telegramMessageId })
        .where(eq(notificationQueue.id, job.id));
      dataEvents.emit("refresh", job.userId);
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
      if (isDead) dataEvents.emit("refresh", job.userId);
    }
  }
}

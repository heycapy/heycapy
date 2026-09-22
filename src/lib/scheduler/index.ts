import { schedule } from "node-cron";
import { and, eq, isNotNull, isNull, lt, ne, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { items, buckets, users, userSettings, notificationLog } from "@/lib/db/schema";
import { NotificationRules, RecurringConfig } from "@/types/rules";
import { sendEmail } from "@/lib/notifications/email";
import { sendNtfy } from "@/lib/notifications/ntfy";
import { sendTelegram } from "@/lib/notifications/telegram";
import { APP_NAME } from "@/constants";
import { errorMessage } from "@/lib/errors";
import { dataEvents } from "@/lib/events";
import { decryptValue } from "@/lib/crypto";
import { getAIProvider } from "@/lib/ai";
import type { AgentMessage } from "@/lib/ai/types";

function isInQuietHours(quietHours: { from: string; to: string }, timezone: string): boolean {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const nowMins = hour * 60 + minute;

  const [fh, fm] = quietHours.from.split(":").map(Number);
  const [th, tm] = quietHours.to.split(":").map(Number);
  const fromMins = (fh ?? 0) * 60 + (fm ?? 0);
  const toMins = (th ?? 0) * 60 + (tm ?? 0);

  return fromMins > toMins
    ? nowMins >= fromMins || nowMins < toMins
    : nowMins >= fromMins && nowMins < toMins;
}

function hasNotifyAtPassed(notifyAt: string, timezone: string, now: Date): boolean {
  const [h = 0, m = 0] = notifyAt.split(":").map(Number);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const currentH = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const currentM = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  return currentH * 60 + currentM >= h * 60 + m;
}

function getNextDeadline(deadline: Date, config: RecurringConfig): Date {
  const next = new Date(deadline);
  const n = config.interval;
  switch (config.frequency) {
    case "daily":
      next.setDate(next.getDate() + n);
      break;
    case "weekly":
      next.setDate(next.getDate() + n * 7);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + n);
      break;
    case "yearly":
      next.setFullYear(next.getFullYear() + n);
      break;
  }
  return next;
}

type PersonalityRow = {
  aiProvider: string | null;
  aiApiKey: string | null;
  aiModel: string | null;
  aiOllamaUrl: string | null;
  personalityName: string;
  personalityTone: string;
  personalityEmoji: boolean;
  personalityCustomPrompt: string | null;
};

async function generateNotificationText(
  title: string,
  deadlineStr: string,
  row: PersonalityRow
): Promise<string> {
  const fallback = `Reminder: "${title}" is due ${deadlineStr}`;
  if (!row.aiProvider) return fallback;

  try {
    const decryptedKey = row.aiApiKey ? decryptValue(row.aiApiKey) : null;
    const ai = getAIProvider({
      provider: row.aiProvider,
      apiKey: decryptedKey,
      model: row.aiModel,
      ollamaUrl: row.aiOllamaUrl,
    });

    const toneGuide =
      row.personalityTone === "custom" && row.personalityCustomPrompt
        ? row.personalityCustomPrompt
        : ({
            chill: "casual and friendly",
            professional: "professional and concise",
            motivational: "energetic and motivating",
          }[row.personalityTone] ?? "friendly");

    const emojiNote = row.personalityEmoji
      ? "You may use 1-2 relevant emojis."
      : "Do not use emojis.";

    const messages: AgentMessage[] = [
      {
        role: "system",
        content: `You are ${row.personalityName}, a helpful assistant. Write a single short push notification sentence reminding the user about an upcoming deadline. Tone: ${toneGuide}. ${emojiNote} Output only the notification text — no quotes, no labels, nothing else.`,
      },
      {
        role: "user",
        content: `Item: "${title}" is due ${deadlineStr}.`,
      },
    ];

    const result = await Promise.race([
      ai.complete(messages, []),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("AI timeout")), 8000)),
    ]);
    return result.content?.trim() || fallback;
  } catch {
    return fallback;
  }
}

async function runNotifications(): Promise<void> {
  const now = new Date();
  const todayMidnight = new Date(now);
  todayMidnight.setUTCHours(0, 0, 0, 0);
  process.stderr.write(`[scheduler] run at ${now.toISOString()}\n`);

  const candidates = await db
    .select({
      item: items,
      bucketNotifRules: buckets.notificationsRules,
      userEmail: users.email,
      userTimezone: userSettings.timezone,
      notificationsEmail: userSettings.notificationsEmail,
      notificationsPush: userSettings.notificationsPush,
      ntfyUrl: userSettings.ntfyUrl,
      ntfyTopic: userSettings.ntfyTopic,
      telegramBotToken: userSettings.telegramBotToken,
      telegramChatId: userSettings.telegramChatId,
      notificationsTelegram: userSettings.notificationsTelegram,
      aiProvider: userSettings.aiProvider,
      aiApiKey: userSettings.aiApiKey,
      aiModel: userSettings.aiModel,
      aiOllamaUrl: userSettings.aiOllamaUrl,
      personalityName: userSettings.personalityName,
      personalityTone: userSettings.personalityTone,
      personalityEmoji: userSettings.personalityEmoji,
      personalityCustomPrompt: userSettings.personalityCustomPrompt,
    })
    .from(items)
    .innerJoin(buckets, eq(items.bucketId, buckets.id))
    .innerJoin(users, eq(items.userId, users.id))
    .innerJoin(userSettings, eq(items.userId, userSettings.userId))
    .where(
      and(
        isNotNull(items.deadline),
        isNull(items.deletedAt),
        ne(items.status, "completed"),
        ne(items.status, "snoozed"),
        or(isNull(items.notifiedAt), lt(items.notifiedAt, todayMidnight)),
        or(isNull(items.snoozedUntil), lt(items.snoozedUntil, now))
      )
    )
    .limit(500);

  process.stderr.write(`[scheduler] ${candidates.length} candidate(s)\n`);

  for (const row of candidates) {
    const tag = `[scheduler] item ${row.item.id} "${row.item.title}"`;
    try {
      const rules = NotificationRules.parse(JSON.parse(row.bucketNotifRules));

      if (rules.medium.length === 0) {
        process.stderr.write(`${tag} skip: no medium\n`);
        continue;
      }

      const deadline = row.item.deadline;
      if (!deadline) {
        process.stderr.write(`${tag} skip: no deadline\n`);
        continue;
      }

      if (row.item.notifiedAt && rules.repeat !== "daily") {
        process.stderr.write(
          `${tag} skip: already notified at ${row.item.notifiedAt.toISOString()}\n`
        );
        continue;
      }

      const offsetMins = row.item.notificationOffsetMins ?? rules.defaultOffsetMins;
      const triggerTime = new Date(deadline.getTime() - offsetMins * 60 * 1000);

      if (triggerTime > now) {
        process.stderr.write(
          `${tag} skip: triggerTime ${triggerTime.toISOString()} > now ${now.toISOString()}\n`
        );
        continue;
      }

      if (rules.notifyAt && !hasNotifyAtPassed(rules.notifyAt, row.userTimezone, now)) {
        process.stderr.write(
          `${tag} skip: notifyAt=${rules.notifyAt} not yet reached in tz=${row.userTimezone}\n`
        );
        continue;
      }

      if (rules.quietHours && isInQuietHours(rules.quietHours, row.userTimezone)) {
        process.stderr.write(`${tag} skip: quiet hours\n`);
        continue;
      }

      const deadlineStr = deadline.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const subject = `[${APP_NAME}] ${row.item.title}`;
      const message = await generateNotificationText(row.item.title, deadlineStr, row);

      const sent: ("email" | "ntfy" | "telegram")[] = [];
      const failures: { medium: "email" | "ntfy" | "telegram"; error: string }[] = [];

      if (rules.medium.includes("email") && row.notificationsEmail) {
        try {
          await sendEmail(row.userEmail, subject, message);
          sent.push("email");
        } catch (err) {
          failures.push({ medium: "email", error: errorMessage(err) });
        }
      }

      if (rules.medium.includes("ntfy") && row.notificationsPush && row.ntfyUrl && row.ntfyTopic) {
        try {
          await sendNtfy(row.ntfyUrl, row.ntfyTopic, subject, message);
          sent.push("ntfy");
        } catch (err) {
          failures.push({ medium: "ntfy", error: errorMessage(err) });
        }
      }

      if (
        rules.medium.includes("telegram") &&
        row.notificationsTelegram &&
        row.telegramBotToken &&
        row.telegramChatId
      ) {
        try {
          await sendTelegram(row.telegramBotToken, row.telegramChatId, message);
          sent.push("telegram");
        } catch (err) {
          failures.push({ medium: "telegram", error: errorMessage(err) });
        }
      }

      for (const f of failures) {
        await db.insert(notificationLog).values({
          itemId: row.item.id,
          userId: row.item.userId,
          medium: f.medium,
          message,
          status: "failed",
          error: f.error,
        });
      }

      if (sent.length === 0) continue;

      dataEvents.emit("refresh");

      db.transaction((tx) => {
        tx.update(items).set({ notifiedAt: now }).where(eq(items.id, row.item.id)).run();

        for (const medium of sent) {
          tx.insert(notificationLog)
            .values({
              itemId: row.item.id,
              userId: row.item.userId,
              medium,
              message,
              status: "sent",
            })
            .run();
        }

        if (row.item.recurring) {
          const recurringConfig = RecurringConfig.parse(JSON.parse(row.item.recurring));
          if (recurringConfig.enabled) {
            let nextDeadline = getNextDeadline(deadline, recurringConfig);
            while (nextDeadline <= now) {
              nextDeadline = getNextDeadline(nextDeadline, recurringConfig);
            }
            const withinEndDate =
              !recurringConfig.endDate || nextDeadline <= new Date(recurringConfig.endDate);
            if (withinEndDate) {
              tx.insert(items)
                .values({
                  bucketId: row.item.bucketId,
                  userId: row.item.userId,
                  title: row.item.title,
                  deadline: nextDeadline,
                  status: "active",
                  notificationOffsetMins: row.item.notificationOffsetMins,
                  recurring: row.item.recurring,
                  source: row.item.source,
                })
                .run();
            }
          }
        }
      });
    } catch (err) {
      process.stderr.write(`[scheduler] item ${row.item.id} failed: ${errorMessage(err)}\n`);
    }
  }
}

export { runNotifications };

let started = false;

export function startScheduler(): void {
  if (started) return;
  started = true;

  schedule(
    "* * * * *",
    () => {
      void runNotifications();
    },
    { noOverlap: true }
  );
}

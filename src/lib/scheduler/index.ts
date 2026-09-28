import { formatWhen } from "@/lib/format-date";
import { schedule } from "node-cron";
import { asc, eq, lte } from "drizzle-orm";
import { backupDatabase, db } from "@/lib/db";
import { items, buckets, users, userSettings } from "@/lib/db/schema";
import { APP_NAME } from "@/constants";
import { errorMessage } from "@/lib/errors";
import { dataEvents } from "@/lib/events";
import { decryptValue } from "@/lib/crypto";
import { getAIProvider } from "@/lib/ai";
import { enqueueNotification, processPending } from "@/lib/notifications/queue";
import { channelDecisions } from "@/lib/notifications/channels";
import { nextDeadlineReminder, nextOverdueAlert } from "@/lib/reminders/schedule";
import { reconcile, reminderRowFields, toReminderInputs } from "@/lib/reminders/refresh";
import {
  REMINDER_BATCH_SIZE,
  REMINDER_MAX_BATCHES_PER_RUN,
  REMINDER_RETRY_DELAY_MS,
} from "@/lib/reminders/constants";
import { SCHEDULER_AI_TIMEOUT_MS } from "./constants";
import type { AgentMessage } from "@/lib/ai/types";

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
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("AI timeout")), SCHEDULER_AI_TIMEOUT_MS)
      ),
    ]);
    return result.content?.trim() || fallback;
  } catch {
    return fallback;
  }
}

const shortTitle = (title: string) => (title.length > 60 ? `${title.slice(0, 60)}…` : title);

const dueRowFields = {
  ...reminderRowFields,
  userId: users.id,
  notificationsEmail: userSettings.notificationsEmail,
  emailProvider: userSettings.emailProvider,
  smtpHost: userSettings.smtpHost,
  notificationsPush: userSettings.notificationsPush,
  ntfyUrl: userSettings.ntfyUrl,
  ntfyTopic: userSettings.ntfyTopic,
  telegramChatId: userSettings.telegramChatId,
  notificationsTelegram: userSettings.notificationsTelegram,
  aiProvider: userSettings.aiProvider,
  aiApiKey: userSettings.aiApiKey,
  aiModel: userSettings.aiModel,
  aiOllamaUrl: userSettings.aiOllamaUrl,
  aiNotifyMessages: userSettings.aiNotifyMessages,
  personalityName: userSettings.personalityName,
  personalityTone: userSettings.personalityTone,
  personalityEmoji: userSettings.personalityEmoji,
  personalityCustomPrompt: userSettings.personalityCustomPrompt,
};

type DueKey = "nextReminderAt" | "nextOverdueAt";
type DueRow = Awaited<ReturnType<typeof selectDue>>[number];

function selectDue(key: DueKey, now: Date) {
  return db
    .select(dueRowFields)
    .from(items)
    .innerJoin(buckets, eq(items.bucketId, buckets.id))
    .innerJoin(users, eq(items.userId, users.id))
    .innerJoin(userSettings, eq(items.userId, userSettings.userId))
    .where(lte(items[key], now))
    .orderBy(asc(items[key]))
    .limit(REMINDER_BATCH_SIZE);
}

// `handle` must move the due time past `now` or clear it, or the item repeats
async function drainDue(
  key: DueKey,
  now: Date,
  handle: (row: DueRow) => Promise<void>
): Promise<void> {
  for (let batch = 0; batch < REMINDER_MAX_BATCHES_PER_RUN; batch++) {
    const rows = await selectDue(key, now);
    if (rows.length === 0) return;
    for (const row of rows) {
      try {
        await handle(row);
      } catch (err) {
        process.stderr.write(`[scheduler] item ${row.item.id} failed: ${errorMessage(err)}\n`);
        await db
          .update(items)
          .set({ [key]: new Date(now.getTime() + REMINDER_RETRY_DELAY_MS) })
          .where(eq(items.id, row.item.id));
      }
    }
  }
  process.stderr.write(`[scheduler] ${key}: more due items than one run handles\n`);
}

async function sendDeadlineReminder(row: DueRow, now: Date): Promise<void> {
  const inputs = toReminderInputs(row);
  const due = nextDeadlineReminder(inputs);
  // Re-check live state; the stored time may be stale
  const deadline = row.item.deadline;
  if (!due || due > now || !deadline) {
    await db.update(items).set({ nextReminderAt: due }).where(eq(items.id, row.item.id));
    return;
  }

  const channels = channelDecisions(inputs.rules.medium, row);
  const sending = channels.some((c) => c.state === "send");
  const deadlineStr = formatWhen(deadline, now, inputs.timezone);
  const message =
    sending && row.aiNotifyMessages
      ? await generateNotificationText(row.item.title, deadlineStr, row)
      : `due ${deadlineStr}`;
  await enqueueNotification({
    userId: row.userId,
    itemId: row.item.id,
    kind: "reminder",
    title: `[${APP_NAME}] ${shortTitle(row.item.title)}`,
    message,
    channels,
  });
  if (!sending) {
    process.stderr.write(`[scheduler] item ${row.item.id} skip: no delivery channels configured\n`);
  }

  await db
    .update(items)
    .set({
      notifiedAt: now,
      nextReminderAt: nextDeadlineReminder({ ...inputs, notifiedAt: now }),
    })
    .where(eq(items.id, row.item.id));
  dataEvents.emit("refresh", row.userId);
}

async function sendOverdueAlert(row: DueRow, now: Date): Promise<void> {
  const inputs = toReminderInputs(row);
  const due = nextOverdueAlert(inputs);
  const deadline = row.item.deadline;
  if (!due || due > now || !deadline) {
    await db.update(items).set({ nextOverdueAt: due }).where(eq(items.id, row.item.id));
    return;
  }

  await enqueueNotification({
    userId: row.userId,
    itemId: row.item.id,
    kind: "overdue",
    title: `[${APP_NAME}] Overdue: ${shortTitle(row.item.title)}`,
    message: `overdue — was due ${formatWhen(deadline, now, inputs.timezone)}`,
    channels: channelDecisions(inputs.rules.medium, row),
  });

  await db
    .update(items)
    .set({
      overdueNotifiedAt: now,
      nextOverdueAt: nextOverdueAlert({ ...inputs, overdueNotifiedAt: now }),
    })
    .where(eq(items.id, row.item.id));
}

async function runNotifications(): Promise<void> {
  const now = new Date();
  process.stderr.write(`[scheduler] run at ${now.toISOString()}\n`);

  try {
    await drainDue("nextReminderAt", now, (row) => sendDeadlineReminder(row, now));
    await drainDue("nextOverdueAt", now, (row) => sendOverdueAlert(row, now));
  } catch (err) {
    process.stderr.write(`[scheduler] run failed: ${errorMessage(err)}\n`);
  }
  await processPending().catch((err) => {
    process.stderr.write(`[scheduler] processPending error: ${errorMessage(err)}\n`);
  });
}

export { runNotifications };

let started = false;

async function reconcileReminders(): Promise<void> {
  await reconcile().catch((err) => {
    process.stderr.write(`[scheduler] reconcile error: ${errorMessage(err)}\n`);
  });
}

async function runBackup(): Promise<void> {
  await backupDatabase().catch((err) => {
    process.stderr.write(`[scheduler] backup failed: ${errorMessage(err)}\n`);
  });
}

export function startScheduler(): void {
  if (started) return;
  started = true;

  // Backfill on startup, then hourly as a safety net
  void reconcileReminders().then(() => {
    schedule("* * * * *", () => void runNotifications(), { noOverlap: true });
    schedule("17 * * * *", () => void reconcileReminders(), { noOverlap: true });
    schedule("40 3 * * *", () => void runBackup(), { noOverlap: true });
  });
}

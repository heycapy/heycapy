import { pruneSystemErrors, recordSystemError } from "@/lib/system-errors";
import { purgeOldTrash } from "@/lib/items/trash";
import { moveOnMissedOccurrences } from "@/lib/items/recurrence";
import { formatWhen } from "@/lib/format-date";
import { schedule } from "node-cron";
import { asc, eq, lte } from "drizzle-orm";
import { backupDatabase, databaseFilePath, db } from "@/lib/db";
import { alertAdminsNow, sendErrorDigest } from "@/lib/admin-alerts";
import { items, buckets, users, userSettings } from "@/lib/db/schema";
import { APP_NAME } from "@/constants";
import { errorMessage } from "@/lib/errors";
import { dataEvents } from "@/lib/events";
import { decryptValue } from "@/lib/crypto";
import { getAIProvider } from "@/lib/ai";
import { enqueueNotification, processPending } from "@/lib/notifications/queue";
import { channelDecisions, hasPushDevice, userWebhooks } from "@/lib/notifications/channels";
import { nextDeadlineReminder, nextOverdueAlert } from "@/lib/reminders/schedule";
import { reconcile, reminderRowFields, toReminderInputs } from "@/lib/reminders/refresh";
import {
  REMINDER_BATCH_SIZE,
  REMINDER_MAX_BATCHES_PER_RUN,
  REMINDER_RETRY_DELAY_MS,
} from "@/lib/reminders/constants";
import { SCHEDULER_AI_TIMEOUT_MS, SCHEDULER_STALE_MS, SCHEDULER_WATCHDOG_MS } from "./constants";
import type { AgentMessage } from "@/lib/ai/types";

type PersonalityRow = {
  aiProvider: string | null;
  aiApiKey: string | null;
  aiModel: string | null;
  aiOllamaUrl: string | null;
  aiUseOwnKey: boolean;
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
      useOwnKey: row.aiUseOwnKey,
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
  hasPushDevice,
  webhooks: userWebhooks,
  aiProvider: userSettings.aiProvider,
  aiApiKey: userSettings.aiApiKey,
  aiModel: userSettings.aiModel,
  aiOllamaUrl: userSettings.aiOllamaUrl,
  aiUseOwnKey: userSettings.aiUseOwnKey,
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
        recordSystemError("scheduler", `item ${row.item.id} failed: ${errorMessage(err)}`, {
          userId: row.userId,
          err,
          context: {
            step: key === "nextReminderAt" ? "reminder" : "overdue alert",
            itemId: row.item.id,
            bucketId: row.item.bucketId,
            deadline: row.item.deadline,
            retryInMin: REMINDER_RETRY_DELAY_MS / 60_000,
          },
        });
        await db
          .update(items)
          .set({ [key]: new Date(now.getTime() + REMINDER_RETRY_DELAY_MS) })
          .where(eq(items.id, row.item.id));
      }
    }
  }
  recordSystemError("scheduler", `${key}: more due items than one run handles`, {
    level: "warning",
    context: { batches: REMINDER_MAX_BATCHES_PER_RUN, batchSize: REMINDER_BATCH_SIZE },
  });
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

  const channels = channelDecisions(inputs.rules, row);
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
    channels: channelDecisions(inputs.rules, row),
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
    await moveOnMissedOccurrences(now);
    await drainDue("nextReminderAt", now, (row) => sendDeadlineReminder(row, now));
    await drainDue("nextOverdueAt", now, (row) => sendOverdueAlert(row, now));
  } catch (err) {
    recordSystemError("scheduler", `run failed: ${errorMessage(err)}`, {
      err,
      context: { runStartedAt: now },
    });
  }
  await processPending().catch((err) => {
    recordSystemError("queue", `delivery run failed: ${errorMessage(err)}`, { err });
  });
  state.lastRunAt = new Date();
}

export { runNotifications };

// On globalThis: Next bundles instrumentation and route handlers separately, and both need this
type RunState = { startedAt: Date | null; lastRunAt: Date | null };
declare global {
  var __heycapyScheduler: RunState | undefined;
}
const state: RunState = (globalThis.__heycapyScheduler ??= { startedAt: null, lastRunAt: null });

export type SchedulerHealth = {
  started: boolean;
  lastRunAt: Date | null;
  stale: boolean;
};

export function schedulerHealth(
  now = new Date(),
  staleAfterMs = SCHEDULER_STALE_MS
): SchedulerHealth {
  const since = state.lastRunAt ?? state.startedAt;
  return {
    started: state.startedAt !== null,
    lastRunAt: state.lastRunAt,
    stale: !since || now.getTime() - since.getTime() > staleAfterMs,
  };
}

async function reconcileReminders(): Promise<void> {
  await reconcile().catch((err) => {
    recordSystemError("scheduler", `reconcile failed: ${errorMessage(err)}`, { err });
  });
  await pruneSystemErrors().catch(() => {});
}

async function sendDigest(): Promise<void> {
  // Not recorded as a system error: that would alert about alerting heheheh
  await sendErrorDigest().catch((err) => {
    process.stderr.write(`[admin-alerts] digest failed: ${errorMessage(err)}\n`);
  });
}

async function runTrashCleanup(): Promise<void> {
  await purgeOldTrash().catch((err) => {
    recordSystemError("trash", `cleanup failed: ${errorMessage(err)}`, { err });
  });
}

async function runBackup(): Promise<void> {
  await backupDatabase().catch((err) => {
    recordSystemError("backup", `backup failed: ${errorMessage(err)}`, {
      level: "critical",
      err,
      context: { database: databaseFilePath() },
    });
  });
}

export function startScheduler(): void {
  if (state.startedAt) return;
  state.startedAt = new Date();

  // Backstop for anything the delivery timeouts don't catch: the platform restarts a failed process
  if (process.env.NODE_ENV === "production") {
    setInterval(async () => {
      if (!schedulerHealth(new Date(), SCHEDULER_WATCHDOG_MS).stale) return;
      const error = recordSystemError(
        "watchdog",
        `no finished run since ${(state.lastRunAt ?? state.startedAt)?.toISOString()} — restarting the app`,
        {
          level: "critical",
          alert: false,
          context: { startedAt: state.startedAt, lastRunAt: state.lastRunAt },
        }
      );
      // tell the admins before the process is gone
      if (error) await alertAdminsNow(error);
      process.exit(1);
    }, 60_000).unref();
  }

  void reconcileReminders().then(() => {
    schedule("* * * * *", () => void runNotifications(), { noOverlap: true });
    schedule("17 * * * *", () => void reconcileReminders(), { noOverlap: true });
    schedule("40 3 * * *", () => void runBackup(), { noOverlap: true });
    schedule("50 3 * * *", () => void runTrashCleanup(), { noOverlap: true });
    schedule("5 * * * *", () => void sendDigest(), { noOverlap: true });
  });
}

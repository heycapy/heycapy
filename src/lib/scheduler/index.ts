import { schedule } from "node-cron";
import { and, eq, isNotNull, isNull, lt, ne, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { items, buckets, users, userSettings, notificationLog } from "@/lib/db/schema";
import { NotificationRules, RecurringConfig } from "@/types/rules";
import { sendEmail } from "@/lib/notifications/email";
import { sendNtfy } from "@/lib/notifications/ntfy";
import { APP_NAME } from "@/constants";

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

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
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

async function runNotifications(): Promise<void> {
  const now = new Date();
  const todayMidnight = new Date(now);
  todayMidnight.setUTCHours(0, 0, 0, 0);

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

  for (const row of candidates) {
    try {
      const rules = NotificationRules.parse(JSON.parse(row.bucketNotifRules));

      if (rules.medium.length === 0) continue;

      const deadline = row.item.deadline;
      if (!deadline) continue;

      if (row.item.notifiedAt && rules.repeat !== "daily") continue;

      const offsetMins = row.item.notificationOffsetMins ?? rules.defaultOffsetMins;
      const triggerTime = new Date(deadline.getTime() - offsetMins * 60 * 1000);

      if (triggerTime > now) continue;

      let sendTime: Date;
      if (rules.notifyAt) {
        const [h, m] = rules.notifyAt.split(":").map(Number);
        sendTime = new Date(now);
        sendTime.setHours(h ?? 9, m ?? 0, 0, 0);
      } else {
        sendTime = triggerTime;
      }
      if (sendTime > now) continue;

      if (rules.quietHours && isInQuietHours(rules.quietHours, row.userTimezone)) continue;

      const deadlineStr = deadline.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const subject = `[${APP_NAME}] ${row.item.title}`;
      const message = `Reminder: "${row.item.title}" is due ${deadlineStr}`;

      const sent: ("email" | "ntfy")[] = [];
      const failures: { medium: "email" | "ntfy"; error: string }[] = [];

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

      await db.transaction(async (tx) => {
        await tx.update(items).set({ notifiedAt: now }).where(eq(items.id, row.item.id));

        for (const medium of sent) {
          await tx.insert(notificationLog).values({
            itemId: row.item.id,
            userId: row.item.userId,
            medium,
            message,
            status: "sent",
          });
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
              await tx.insert(items).values({
                bucketId: row.item.bucketId,
                userId: row.item.userId,
                title: row.item.title,
                deadline: nextDeadline,
                status: "active",
                notificationOffsetMins: row.item.notificationOffsetMins,
                recurring: row.item.recurring,
                source: row.item.source,
              });
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

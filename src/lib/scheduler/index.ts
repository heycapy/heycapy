import { schedule } from "node-cron";
import { and, eq, isNotNull, isNull, lt, ne, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { items, buckets, users, userSettings, notificationLog } from "@/lib/db/schema";
import { NotificationRules, RecurringConfig } from "@/types/rules";
import { sendEmail } from "@/lib/notifications/email";
import { sendNtfy } from "@/lib/notifications/ntfy";
import { APP_NAME } from "@/constants";

function isInQuietHours(quietHours: { from: string; to: string }): boolean {
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const [fh, fm] = quietHours.from.split(":").map(Number);
  const [th, tm] = quietHours.to.split(":").map(Number);
  const fromMins = (fh ?? 0) * 60 + (fm ?? 0);
  const toMins = (th ?? 0) * 60 + (tm ?? 0);
  // Crosses midnight when from > to (e.g. 22:00–08:00)
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

  // For daily repeat: re-notify if last notification was before today (UTC midnight)
  const todayMidnight = new Date(now);
  todayMidnight.setUTCHours(0, 0, 0, 0);

  const candidates = await db
    .select({
      item: items,
      bucketNotifRules: buckets.notificationsRules,
      userEmail: users.email,
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
    );

  for (const row of candidates) {
    try {
      const rules = NotificationRules.parse(JSON.parse(row.bucketNotifRules));

      if (rules.medium.length === 0) continue;

      const deadline = row.item.deadline;
      if (!deadline) continue;

      // Skip if already notified today for once-only buckets
      if (row.item.notifiedAt && rules.repeat !== "daily") continue;

      const offsetMins = row.item.notificationOffsetMins ?? rules.defaultOffsetMins;
      const triggerTime = new Date(deadline.getTime() - offsetMins * 60 * 1000);

      // Don't notify until the trigger window has opened (deadline - offset <= now)
      if (triggerTime > now) continue;

      // Compute the actual send time: today at notifyAt clock time, or immediately
      let sendTime: Date;
      if (rules.notifyAt) {
        const [h, m] = rules.notifyAt.split(":").map(Number);
        sendTime = new Date(now);
        sendTime.setHours(h ?? 9, m ?? 0, 0, 0);
      } else {
        sendTime = triggerTime;
      }
      if (sendTime > now) continue;

      if (rules.quietHours && isInQuietHours(rules.quietHours)) continue;

      const deadlineStr = deadline.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const subject = `[${APP_NAME}] ${row.item.title}`;
      const message = `Reminder: "${row.item.title}" is due ${deadlineStr}`;

      const sent: ("email" | "ntfy")[] = [];

      if (rules.medium.includes("email") && row.notificationsEmail) {
        try {
          await sendEmail(row.userEmail, subject, message);
          sent.push("email");
        } catch (err) {
          await db.insert(notificationLog).values({
            itemId: row.item.id,
            userId: row.item.userId,
            medium: "email",
            message,
            status: "failed",
            error: errorMessage(err),
          });
        }
      }

      if (rules.medium.includes("ntfy") && row.notificationsPush && row.ntfyUrl && row.ntfyTopic) {
        try {
          await sendNtfy(row.ntfyUrl, row.ntfyTopic, subject, message);
          sent.push("ntfy");
        } catch (err) {
          await db.insert(notificationLog).values({
            itemId: row.item.id,
            userId: row.item.userId,
            medium: "ntfy",
            message,
            status: "failed",
            error: errorMessage(err),
          });
        }
      }

      if (sent.length === 0) continue;

      // Stamp notifiedAt and (for recurring) spawn the next occurrence atomically
      await db.transaction(async (tx) => {
        await tx.update(items).set({ notifiedAt: now }).where(eq(items.id, row.item.id));

        if (row.item.recurring) {
          const recurringConfig = RecurringConfig.parse(JSON.parse(row.item.recurring));
          if (recurringConfig.enabled) {
            const nextDeadline = getNextDeadline(deadline, recurringConfig);
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

      for (const medium of sent) {
        await db.insert(notificationLog).values({
          itemId: row.item.id,
          userId: row.item.userId,
          medium,
          message,
          status: "sent",
        });
      }
    } catch {}
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

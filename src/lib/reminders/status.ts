import { bucketChannels } from "@/lib/rules";
import { ITEM_STATUS, isClosedStatus } from "@/constants";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, items, notificationQueue } from "@/lib/db/schema";
import {
  ALL_CHANNELS,
  channelDecisions,
  getChannelSettings,
  type ChannelDecision,
} from "@/lib/notifications/channels";
import type { NotificationMedium } from "@/lib/notifications/queue";

type Item = typeof items.$inferSelect;
type Job = typeof notificationQueue.$inferSelect;

export type ReminderBadge = "failed" | "noChannel" | "upcoming" | "history";

export type ChannelOutcome = {
  medium: NotificationMedium;
  outcome: "sent" | "sending" | "retrying" | "failed" | "closed" | "notSelected" | "notSetUp";
  error: string | null;
  retryAt: Date | null;
};

export type NotificationEvent = {
  kind: Job["kind"];
  at: Date;
  channels: ChannelOutcome[];
};

export type ItemReminderInfo = {
  next: Date | null;
  nextChannels: ChannelDecision[] | null;
  completedAt: Date | null;
  reason: "completed" | "missed" | "onHold" | "noChannel" | "alreadyReminded" | null;
  history: NotificationEvent[];
};

const HISTORY_LIMIT = 10;

async function currentDecisions(userId: number, notificationsRules: string) {
  return channelDecisions(bucketChannels(notificationsRules), await getChannelSettings(userId));
}

function toOutcome(job: Job): ChannelOutcome {
  const outcome: ChannelOutcome["outcome"] =
    job.status === "skipped"
      ? (job.skipReason ?? "notSelected")
      : job.status === "sent"
        ? "sent"
        : job.status === "dead"
          ? "failed"
          : job.status === "cancelled"
            ? "closed"
            : job.attempts > 0
              ? "retrying"
              : "sending";
  return {
    medium: job.medium,
    outcome,
    error: outcome === "failed" || outcome === "retrying" ? job.lastError : null,
    retryAt: outcome === "retrying" ? job.nextRetryAt : null,
  };
}

// One notification = same kind and creation time, with at most one entry per channel
function groupIntoEvents(jobs: Job[]): NotificationEvent[] {
  const events: NotificationEvent[] = [];
  for (const job of jobs) {
    const last = events[events.length - 1];
    if (
      last &&
      last.kind === job.kind &&
      last.at.getTime() === job.createdAt.getTime() &&
      !last.channels.some((c) => c.medium === job.medium)
    ) {
      last.channels.push(toOutcome(job));
    } else {
      events.push({ kind: job.kind, at: job.createdAt, channels: [toOutcome(job)] });
    }
  }
  for (const event of events) {
    event.channels.sort((a, b) => ALL_CHANNELS.indexOf(a.medium) - ALL_CHANNELS.indexOf(b.medium));
  }
  return events;
}

export async function getReminderBadges(
  userId: number,
  notificationsRules: string,
  bucketItems: Item[]
): Promise<Record<number, ReminderBadge>> {
  const dated = bucketItems.filter((i) => i.deadline && !i.deletedAt);
  if (dated.length === 0) return {};
  const open = dated.filter((i) => !isClosedStatus(i.status));

  const jobs =
    open.length === 0
      ? []
      : await db
          .select()
          .from(notificationQueue)
          .where(
            inArray(
              notificationQueue.itemId,
              open.map((i) => i.id)
            )
          )
          .orderBy(desc(notificationQueue.id));

  // Newest delivery per channel only, so a later success clears an old failure
  const failed = new Set<number>();
  const seen = new Set<string>();
  for (const job of jobs) {
    if (job.status === "skipped") continue;
    const key = `${job.itemId}:${job.medium}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (job.status === "dead" && job.itemId) failed.add(job.itemId);
  }

  const hasChannel = (await currentDecisions(userId, notificationsRules)).some(
    (c) => c.state === "send"
  );
  const badges: Record<number, ReminderBadge> = {};
  for (const item of dated) {
    const isOpen = !isClosedStatus(item.status);
    if (isOpen && failed.has(item.id)) badges[item.id] = "failed";
    else if (isOpen && !hasChannel) badges[item.id] = "noChannel";
    else if (isOpen && item.nextReminderAt) badges[item.id] = "upcoming";
    else badges[item.id] = "history";
  }
  return badges;
}

export async function getItemReminderInfo(
  userId: number,
  itemId: number
): Promise<ItemReminderInfo | null> {
  const [row] = await db
    .select({ item: items, notificationsRules: buckets.notificationsRules })
    .from(items)
    .innerJoin(buckets, eq(items.bucketId, buckets.id))
    .where(and(eq(items.id, itemId), eq(items.userId, userId)));
  if (!row?.item.deadline) return null;
  const { item } = row;

  const decisions = await currentDecisions(userId, row.notificationsRules);
  const jobs = await db
    .select()
    .from(notificationQueue)
    .where(eq(notificationQueue.itemId, itemId))
    .orderBy(desc(notificationQueue.id))
    .limit(HISTORY_LIMIT * decisions.length);

  const reason =
    item.status === ITEM_STATUS.completed
      ? "completed"
      : item.status === ITEM_STATUS.missed
        ? "missed"
        : item.status === ITEM_STATUS.onHold
          ? "onHold"
          : !decisions.some((c) => c.state === "send")
            ? "noChannel"
            : item.nextReminderAt
              ? null
              : "alreadyReminded";

  return {
    next: reason ? null : item.nextReminderAt,
    nextChannels: reason ? null : decisions,
    completedAt: item.status === ITEM_STATUS.completed ? item.completedAt : null,
    reason,
    history: groupIntoEvents(jobs).slice(0, HISTORY_LIMIT),
  };
}

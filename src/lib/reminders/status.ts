import { bucketChannels } from "@/lib/rules";
import { ITEM_STATUS, isClosedStatus } from "@/constants";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, itemActions, items, notificationQueue, outgoingWebhooks } from "@/lib/db/schema";
import {
  ALL_CHANNELS,
  channelDecisions,
  getChannelSettings,
  type ChannelDecision,
} from "@/lib/notifications/channels";
import { channelKey } from "@/lib/notifications/channel-key";
import type { NotificationMedium } from "@/lib/notifications/queue";
import { pendingRemindAgainAt } from "./remind-again";

type Item = typeof items.$inferSelect;
type Job = typeof notificationQueue.$inferSelect;

export type ReminderBadge = "failed" | "noChannel" | "upcoming" | "history";

export type ChannelOutcome = {
  medium: NotificationMedium;
  webhookId: number | null;
  label: string;
  outcome: "sent" | "sending" | "retrying" | "failed" | "closed" | "notSelected" | "notSetUp";
  error: string | null;
  retryAt: Date | null;
};

export type NotificationEvent = {
  type: "sent";
  kind: Job["kind"];
  at: Date;
  channels: ChannelOutcome[];
};

type Action = typeof itemActions.$inferSelect;

export type ActionEvent = {
  type: "action";
  at: Date;
  action: Action["action"];
  source: Action["source"];
  remindAt: Date | null;
};

export type HistoryEvent = NotificationEvent | ActionEvent;

export type ItemReminderInfo = {
  next: Date | null;
  nextChannels: ChannelDecision[] | null;
  completedAt: Date | null;
  reason: "completed" | "missed" | "onHold" | "noChannel" | "alreadyReminded" | null;
  remindAgain: { at: Date; source: Action["source"] } | null;
  history: HistoryEvent[];
};

const HISTORY_LIMIT = 10;

async function currentDecisions(userId: number, notificationsRules: string) {
  return channelDecisions(bucketChannels(notificationsRules), await getChannelSettings(userId));
}

type JobRow = { job: Job; webhookName: string | null };

function toOutcome({ job, webhookName }: JobRow): ChannelOutcome {
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
    webhookId: job.webhookId,
    label: job.medium === "webhook" ? (webhookName ?? "deleted webhook") : job.medium,
    outcome,
    error: outcome === "failed" || outcome === "retrying" ? job.lastError : null,
    retryAt: outcome === "retrying" ? job.nextRetryAt : null,
  };
}

// One notification = same kind and creation time, with at most one entry per channel
function groupIntoEvents(rows: JobRow[]): NotificationEvent[] {
  const events: NotificationEvent[] = [];
  for (const row of rows) {
    const { job } = row;
    const last = events[events.length - 1];
    if (
      last &&
      last.kind === job.kind &&
      last.at.getTime() === job.createdAt.getTime() &&
      !last.channels.some((c) => channelKey(c) === channelKey(job))
    ) {
      last.channels.push(toOutcome(row));
    } else {
      events.push({ type: "sent", kind: job.kind, at: job.createdAt, channels: [toOutcome(row)] });
    }
  }
  for (const event of events) {
    event.channels.sort(
      (a, b) =>
        ALL_CHANNELS.indexOf(a.medium) - ALL_CHANNELS.indexOf(b.medium) ||
        (a.webhookId ?? 0) - (b.webhookId ?? 0)
    );
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
    const key = `${job.itemId}:${channelKey(job)}`;
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
  const now = new Date();

  const decisions = await currentDecisions(userId, row.notificationsRules);
  const jobs = await db
    .select({ job: notificationQueue, webhookName: outgoingWebhooks.name })
    .from(notificationQueue)
    .leftJoin(outgoingWebhooks, eq(outgoingWebhooks.id, notificationQueue.webhookId))
    .where(eq(notificationQueue.itemId, itemId))
    .orderBy(desc(notificationQueue.id))
    .limit(HISTORY_LIMIT * decisions.length);
  const actions = await db
    .select()
    .from(itemActions)
    .where(eq(itemActions.itemId, itemId))
    .orderBy(desc(itemActions.id))
    .limit(HISTORY_LIMIT);

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

  const remindAgainAt = pendingRemindAgainAt(item, now);
  const askedFrom = actions.find((a) => a.action === "remindAgain");
  const history: HistoryEvent[] = [
    ...groupIntoEvents(jobs),
    ...actions.map((a) => ({
      type: "action" as const,
      at: a.createdAt,
      action: a.action,
      source: a.source,
      remindAt: a.remindAt,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, HISTORY_LIMIT);

  return {
    next: reason ? null : item.nextReminderAt,
    nextChannels: reason ? null : decisions,
    completedAt: item.status === ITEM_STATUS.completed ? item.completedAt : null,
    reason,
    remindAgain: remindAgainAt ? { at: remindAgainAt, source: askedFrom?.source ?? "app" } : null,
    history,
  };
}

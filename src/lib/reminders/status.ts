import { ITEM_STATUS, isClosedStatus } from "@/constants";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  users,
  itemActions,
  itemReminders,
  items,
  notificationQueue,
  outgoingWebhooks,
} from "@/lib/db/schema";
import {
  ALL_CHANNELS,
  channelDecisions,
  getChannelSettings,
  getMemberChannels,
  type ChannelDecision,
} from "@/lib/notifications/channels";
import { channelKey } from "@/lib/notifications/channel-key";
import { NOT_RECIPIENT_ERROR } from "@/lib/notifications/constants";
import { memberBucketIds } from "@/lib/buckets/access";
import type { NotificationMedium } from "@/lib/notifications/queue";
import { pendingRemindAgainAt } from "./remind-again";
import { selectReminderRows, toReminderInputs } from "./refresh";
import { heldByQuietHours } from "./schedule";
import { memberName } from "@/lib/buckets/member-name";
import { UNSET_TIMEZONE } from "@/lib/timezones/constants";

type Item = typeof items.$inferSelect;
type Reminder = typeof itemReminders.$inferSelect;
type Job = typeof notificationQueue.$inferSelect;

export type ReminderBadge = "failed" | "noChannel" | "upcoming" | "history";

export type ChannelOutcome = {
  medium: NotificationMedium;
  webhookId: number | null;
  label: string;
  outcome:
    | "sent"
    | "sending"
    | "retrying"
    | "failed"
    | "closed"
    | "handedOver"
    | "notSelected"
    | "notSetUp";
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
  by: string;
  byId: number;
  byAvatar: string | null;
};

// Someone else reminded about the item, as the viewer sees them
export type OtherRecipient = {
  userId: number;
  avatar: string | null;
  name: string;
  timezone: string;
  next: Date | null;
  heldByQuietHours: boolean;
};

export type HistoryEvent = NotificationEvent | ActionEvent;

export type ItemReminderInfo = {
  next: Date | null;
  nextChannels: ChannelDecision[] | null;
  completedAt: Date | null;
  reason:
    "completed" | "missed" | "onHold" | "notRecipient" | "noChannel" | "alreadyReminded" | null;
  remindAgain: { at: Date; source: Action["source"] } | null;
  heldByQuietHours: boolean;
  others: OtherRecipient[];
  history: HistoryEvent[];
};

// An item as one person sees it: their own reminder times, none when they aren't reminded about it
export type ListItem = Item & Partial<Pick<Reminder, "nextReminderAt" | "nextOverdueAt">>;

const HISTORY_LIMIT = 10;

function viewerRows(userId: number, itemIds: number[]): Promise<Reminder[]> {
  if (itemIds.length === 0) return Promise.resolve([]);
  return db
    .select()
    .from(itemReminders)
    .where(and(eq(itemReminders.userId, userId), inArray(itemReminders.itemId, itemIds)));
}

function asViewer(item: Item, mine: Reminder | undefined): ListItem {
  return {
    ...item,
    nextReminderAt: mine?.nextReminderAt ?? null,
    nextOverdueAt: mine?.nextOverdueAt ?? null,
    ...(mine && { notifiedAt: mine.notifiedAt, overdueNotifiedAt: mine.overdueNotifiedAt }),
  };
}

export async function withViewerReminders(userId: number, rows: Item[]): Promise<ListItem[]> {
  const mine = new Map(
    (
      await viewerRows(
        userId,
        rows.map((i) => i.id)
      )
    ).map((r) => [r.itemId, r])
  );
  return rows.map((item) => asViewer(item, mine.get(item.id)));
}

async function currentDecisions(userId: number, bucketId: number) {
  return channelDecisions(
    await getMemberChannels(userId, bucketId),
    await getChannelSettings(userId)
  );
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
            ? job.lastError === NOT_RECIPIENT_ERROR
              ? "handedOver"
              : "closed"
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
  bucketId: number,
  bucketItems: ListItem[]
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
            and(
              eq(notificationQueue.userId, userId),
              inArray(
                notificationQueue.itemId,
                open.map((i) => i.id)
              )
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

  const hasChannel = (await currentDecisions(userId, bucketId)).some((c) => c.state === "send");
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
    .select({ item: items })
    .from(items)
    .where(and(eq(items.id, itemId), inArray(items.bucketId, memberBucketIds(userId))));
  if (!row?.item.deadline) return null;
  const [mine] = await viewerRows(userId, [itemId]);
  const item = asViewer(row.item, mine);
  const now = new Date();

  const decisions = await currentDecisions(userId, row.item.bucketId);
  const jobs = await db
    .select({ job: notificationQueue, webhookName: outgoingWebhooks.name })
    .from(notificationQueue)
    .leftJoin(outgoingWebhooks, eq(outgoingWebhooks.id, notificationQueue.webhookId))
    .where(and(eq(notificationQueue.itemId, itemId), eq(notificationQueue.userId, userId)))
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
          : !mine
            ? "notRecipient"
            : !decisions.some((c) => c.state === "send")
              ? "noChannel"
              : item.nextReminderAt
                ? null
                : "alreadyReminded";

  const recipients = isClosedStatus(item.status)
    ? []
    : await selectReminderRows(eq(items.id, itemId));
  const people = await db
    .select({
      id: users.id,
      username: users.username,
      avatar: users.avatar,
    })
    .from(users)
    .where(
      inArray(users.id, [
        ...recipients.map((r) => r.reminder.userId),
        ...actions.map((a) => a.userId),
      ])
    );
  const nameOf = (id: number) => {
    if (id === userId) return "you";
    const person = people.find((p) => p.id === id);
    return person ? memberName(person) : "someone";
  };
  const avatarOf = (id: number) => people.find((p) => p.id === id)?.avatar ?? null;
  const held = (id: number) => {
    const row = recipients.find((r) => r.reminder.userId === id);
    return row !== undefined && heldByQuietHours(toReminderInputs(row));
  };
  const others = recipients
    .filter((r) => r.reminder.userId !== userId)
    .map((r) => ({
      userId: r.reminder.userId,
      avatar: avatarOf(r.reminder.userId),
      name: nameOf(r.reminder.userId),
      timezone: r.timezone ?? UNSET_TIMEZONE,
      next: r.reminder.nextReminderAt,
      heldByQuietHours: held(r.reminder.userId),
    }));

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
      by: nameOf(a.userId),
      byId: a.userId,
      byAvatar: avatarOf(a.userId),
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, HISTORY_LIMIT);

  return {
    next: reason ? null : (item.nextReminderAt ?? null),
    nextChannels: reason ? null : decisions,
    completedAt: item.status === ITEM_STATUS.completed ? item.completedAt : null,
    reason,
    remindAgain: remindAgainAt ? { at: remindAgainAt, source: askedFrom?.source ?? "app" } : null,
    heldByQuietHours: !reason && held(userId),
    others,
    history,
  };
}

import { and, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, items, notificationQueue, outgoingWebhooks } from "@/lib/db/schema";
import { channelKey } from "./channel-key";
import { CHANNEL_FAILURE_WINDOW_MS } from "./constants";
import type { NotificationMedium } from "./queue";

export type FailedDelivery = {
  title: string;
  bucketName: string | null;
  at: Date;
  error: string | null;
};

export type ChannelFailure = {
  medium: NotificationMedium;
  webhookId: number | null;
  label: string;
  deliveries: FailedDelivery[];
};

// Failures on each channel since its last successful delivery, within the window
export async function getChannelFailures(
  userId: number,
  now = new Date()
): Promise<ChannelFailure[]> {
  const rows = await db
    .select({
      job: notificationQueue,
      itemTitle: items.title,
      bucketName: buckets.name,
      webhookName: outgoingWebhooks.name,
    })
    .from(notificationQueue)
    .leftJoin(outgoingWebhooks, eq(outgoingWebhooks.id, notificationQueue.webhookId))
    .leftJoin(items, eq(items.id, notificationQueue.itemId))
    .leftJoin(buckets, eq(buckets.id, items.bucketId))
    .where(
      and(
        eq(notificationQueue.userId, userId),
        inArray(notificationQueue.status, ["sent", "dead"]),
        isNull(notificationQueue.dismissedAt),
        gte(notificationQueue.createdAt, new Date(now.getTime() - CHANNEL_FAILURE_WINDOW_MS))
      )
    )
    .orderBy(desc(notificationQueue.id));

  const recovered = new Set<string>();
  const failures = new Map<string, ChannelFailure>();
  for (const { job, itemTitle, bucketName, webhookName } of rows) {
    // a deleted webhook can't be fixed, so its failures aren't worth a banner
    if (job.medium === "webhook" && !webhookName) continue;
    const key = channelKey(job);
    if (recovered.has(key)) continue;
    if (job.status === "sent") {
      recovered.add(key);
      continue;
    }
    const failure = failures.get(key) ?? {
      medium: job.medium,
      webhookId: job.webhookId,
      label: webhookName ?? job.medium,
      deliveries: [],
    };
    failure.deliveries.push({
      title: itemTitle ?? job.title,
      bucketName,
      at: job.createdAt,
      error: job.lastError,
    });
    failures.set(key, failure);
  }
  return [...failures.values()];
}

export async function dismissChannelFailures(
  userId: number,
  medium: NotificationMedium,
  webhookId: number | null = null
): Promise<void> {
  await db
    .update(notificationQueue)
    .set({ dismissedAt: new Date() })
    .where(
      and(
        eq(notificationQueue.userId, userId),
        eq(notificationQueue.medium, medium),
        webhookId === null ? undefined : eq(notificationQueue.webhookId, webhookId),
        eq(notificationQueue.status, "dead"),
        isNull(notificationQueue.dismissedAt)
      )
    );
}

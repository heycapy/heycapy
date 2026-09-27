import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, items, notificationQueue } from "@/lib/db/schema";
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
  deliveries: FailedDelivery[];
};

// Failures on each channel since its last successful delivery, within the window
export async function getChannelFailures(
  userId: number,
  now = new Date()
): Promise<ChannelFailure[]> {
  const rows = await db
    .select({ job: notificationQueue, itemTitle: items.title, bucketName: buckets.name })
    .from(notificationQueue)
    .leftJoin(items, eq(items.id, notificationQueue.itemId))
    .leftJoin(buckets, eq(buckets.id, items.bucketId))
    .where(
      and(
        eq(notificationQueue.userId, userId),
        inArray(notificationQueue.status, ["sent", "dead"]),
        gte(notificationQueue.createdAt, new Date(now.getTime() - CHANNEL_FAILURE_WINDOW_MS))
      )
    )
    .orderBy(desc(notificationQueue.id));

  const recovered = new Set<NotificationMedium>();
  const failures = new Map<NotificationMedium, FailedDelivery[]>();
  for (const { job, itemTitle, bucketName } of rows) {
    if (recovered.has(job.medium)) continue;
    if (job.status === "sent") {
      recovered.add(job.medium);
      continue;
    }
    const deliveries = failures.get(job.medium) ?? [];
    deliveries.push({
      title: itemTitle ?? job.title,
      bucketName,
      at: job.createdAt,
      error: job.lastError,
    });
    failures.set(job.medium, deliveries);
  }
  return [...failures].map(([medium, deliveries]) => ({ medium, deliveries }));
}

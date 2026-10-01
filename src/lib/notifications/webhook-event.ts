import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, items, type notificationQueue } from "@/lib/db/schema";
import { publicAppUrl } from "@/lib/app-url";
import { isAllDay } from "@/lib/reminders/zoned";
import type { WebhookEvent } from "./webhook-app";

type Job = typeof notificationQueue.$inferSelect;

const EVENT_TYPES = {
  reminder: "item.reminder",
  overdue: "item.overdue",
  arrival: "item.arrived",
} as const;

export async function webhookEvent(job: Job, timezone: string): Promise<WebhookEvent> {
  const [row] = job.itemId
    ? await db
        .select({ item: items, bucketName: buckets.name })
        .from(items)
        .innerJoin(buckets, eq(buckets.id, items.bucketId))
        .where(eq(items.id, job.itemId))
        .limit(1)
    : [];
  const base = publicAppUrl();
  return {
    type: job.kind ? EVENT_TYPES[job.kind] : "notification",
    timestamp: job.createdAt.toISOString(),
    data: {
      title: job.title,
      message: job.message,
      item: row
        ? {
            id: row.item.id,
            title: row.item.title,
            status: row.item.status,
            deadline: row.item.deadline?.toISOString() ?? null,
            allDay: row.item.deadline ? isAllDay(row.item.deadline, timezone) : false,
            timezone,
            url: base && `${base}/?bucket=${row.item.bucketId}#item-${row.item.id}`,
          }
        : null,
      bucket: row ? { id: row.item.bucketId, name: row.bucketName } : null,
    },
  };
}

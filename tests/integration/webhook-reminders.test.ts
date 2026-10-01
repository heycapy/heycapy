import { createHmac } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, notificationQueue, outgoingWebhooks } from "@/lib/db/schema";
import { processPending } from "@/lib/notifications/queue";
import { getChannelFailures } from "@/lib/notifications/failures";
import { withDefaultChannels } from "@/lib/notifications/channels";
import { newWebhookSecret } from "@/lib/notifications/webhook";
import { saveBucketSettings } from "@/lib/buckets/settings";
import { sendTestWebhookAction } from "@/app/(app)/webhook-actions";
import {
  HOUR,
  MINUTE,
  resetSchedulerEnvironment,
  runSchedulerAt,
  seedBucket,
  seedItem,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";
import { startWebhookReceiver, type WebhookReceiver } from "./webhook-receiver";

const session = vi.hoisted(() => ({ userId: 0, email: "someone@heycapy.test" }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => session }));

const T0 = new Date("2026-03-10T12:00:00Z");
const DUE = new Date(T0.getTime() + HOUR);

let receiver: WebhookReceiver;
beforeEach(async () => {
  useSchedulerEnvironment(T0);
  delete process.env.E2E_TEST_MODE;
  receiver = await startWebhookReceiver();
});
afterEach(async () => {
  resetSchedulerEnvironment();
  await receiver.close();
});

async function seedWebhook(userId: number, name: string, isDefault = false) {
  const [row] = await db
    .insert(outgoingWebhooks)
    .values({ userId, name, url: receiver.url, secret: newWebhookSecret(), isDefault })
    .returning();
  return row;
}

async function webhookJobs(userId: number) {
  return db
    .select()
    .from(notificationQueue)
    .where(and(eq(notificationQueue.userId, userId), eq(notificationQueue.medium, "webhook")));
}

it("a reminder in a bucket with a webhook on is sent there, signed, with the item and bucket", async () => {
  const userId = await seedUser("Asia/Kolkata");
  const webhook = await seedWebhook(userId, "work slack");
  const bucketId = await seedBucket(userId, { medium: [], webhooks: [webhook.id], repeat: "once" });
  const itemId = await seedItem(userId, bucketId, { deadline: DUE });

  await runSchedulerAt(DUE);

  const [job] = await webhookJobs(userId);
  expect(job).toMatchObject({ status: "sent", webhookId: webhook.id });
  const [{ headers, body }] = receiver.received;
  expect(headers["webhook-id"]).toBe(`msg_${job.id}`);
  const key = Buffer.from(webhook.secret.slice("whsec_".length), "base64");
  const signed = `${headers["webhook-id"]}.${headers["webhook-timestamp"]}.${body}`;
  expect(headers["webhook-signature"]).toBe(
    `v1,${createHmac("sha256", key).update(signed).digest("base64")}`
  );
  const [bucket] = await db.select().from(buckets).where(eq(buckets.id, bucketId));
  expect(JSON.parse(body)).toEqual({
    type: "item.reminder",
    timestamp: DUE.toISOString(),
    data: {
      title: "[HeyCapy] pay rent",
      message: expect.stringContaining("due"),
      item: {
        id: itemId,
        title: "pay rent",
        status: "active",
        deadline: DUE.toISOString(),
        allDay: false,
        timezone: "Asia/Kolkata",
        url: null,
      },
      bucket: { id: bucketId, name: bucket.name },
    },
  });
});

it("a webhook the bucket hasn't picked gets nothing", async () => {
  const userId = await seedUser();
  const picked = await seedWebhook(userId, "picked");
  const other = await seedWebhook(userId, "other");
  const bucketId = await seedBucket(userId, { medium: [], webhooks: [picked.id], repeat: "once" });
  await seedItem(userId, bucketId, { deadline: DUE });

  await runSchedulerAt(DUE);

  expect(receiver.received).toHaveLength(1);
  const jobs = await webhookJobs(userId);
  expect(jobs.find((j) => j.webhookId === other.id)).toMatchObject({
    status: "skipped",
    skipReason: "notSelected",
  });
});

it("a failing webhook is retried with the same webhook-id, then shows as its own failure until a test works", async () => {
  const userId = await seedUser();
  session.userId = userId;
  const webhook = await seedWebhook(userId, "home");
  const bucketId = await seedBucket(userId, { medium: [], webhooks: [webhook.id], repeat: "once" });
  await seedItem(userId, bucketId, { deadline: DUE });
  receiver.reply(500);

  await runSchedulerAt(DUE);
  for (const mins of [1, 6, 21]) {
    vi.setSystemTime(new Date(DUE.getTime() + mins * MINUTE));
    await processPending();
  }

  const ids = new Set(receiver.received.map((r) => r.headers["webhook-id"]));
  expect(receiver.received).toHaveLength(3);
  expect(ids.size).toBe(1);
  const [job] = await webhookJobs(userId);
  expect(job.status).toBe("dead");
  expect(await getChannelFailures(userId)).toEqual([
    {
      medium: "webhook",
      webhookId: webhook.id,
      label: "home",
      deliveries: [
        expect.objectContaining({ title: "pay rent", error: "webhook error 500: nope" }),
      ],
    },
  ]);

  receiver.reply(200);
  expect(await sendTestWebhookAction(webhook.id)).toEqual({ ok: true });
  expect(await getChannelFailures(userId)).toEqual([]);
});

it("a reminder queued for a webhook deleted before it went out is cancelled", async () => {
  const userId = await seedUser();
  const webhook = await seedWebhook(userId, "gone");
  const bucketId = await seedBucket(userId, { medium: [], webhooks: [webhook.id], repeat: "once" });
  await seedItem(userId, bucketId, { deadline: DUE });
  receiver.reply(500);
  await runSchedulerAt(DUE);

  await db.delete(outgoingWebhooks).where(eq(outgoingWebhooks.id, webhook.id));
  vi.setSystemTime(new Date(DUE.getTime() + 2 * MINUTE));
  await processPending();

  const [job] = await db
    .select()
    .from(notificationQueue)
    .where(and(eq(notificationQueue.userId, userId), eq(notificationQueue.medium, "webhook")));
  expect(job).toMatchObject({ status: "cancelled", webhookId: null });
  expect(receiver.received).toHaveLength(1);
  expect(await getChannelFailures(userId)).toEqual([]);
});

it("new buckets get the webhooks that are on for new buckets", async () => {
  const userId = await seedUser();
  const onByDefault = await seedWebhook(userId, "discord", true);
  await seedWebhook(userId, "n8n", false);

  expect(await withDefaultChannels(userId, {})).toMatchObject({ webhooks: [onByDefault.id] });
  expect(await withDefaultChannels(userId, { webhooks: [] })).toMatchObject({ webhooks: [] });
});

it("bucket settings keep only the user's own webhooks, and leave them alone when not given", async () => {
  const userId = await seedUser();
  const mine = await seedWebhook(userId, "mine");
  const theirs = await seedWebhook(await seedUser(), "theirs");
  const bucketId = await seedBucket(userId, { medium: [], repeat: "once" });
  const save = (webhooks?: number[]) =>
    saveBucketSettings(userId, bucketId, {
      name: `bucket ${bucketId}`,
      itemsRules: {},
      notificationsRules: { medium: [], ...(webhooks && { webhooks }) },
    });
  const stored = async () => {
    const [row] = await db.select().from(buckets).where(eq(buckets.id, bucketId));
    return (JSON.parse(row.notificationsRules) as { webhooks?: number[] }).webhooks;
  };

  expect(await save([mine.id, theirs.id])).toEqual({ ok: true });
  expect(await stored()).toEqual([mine.id]);
  expect(await save()).toEqual({ ok: true });
  expect(await stored()).toEqual([mine.id]);
});

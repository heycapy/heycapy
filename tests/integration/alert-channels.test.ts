import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, notificationQueue, userSettings } from "@/lib/db/schema";
import { encryptValue } from "@/lib/crypto";
import { POST as postWebhook } from "@/app/api/webhook/[bucketId]/route";
import {
  HOUR,
  resetSchedulerEnvironment,
  runSchedulerAt,
  seedBucket,
  seedItem,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

const T0 = new Date("2026-03-10T12:00:00Z");
const KEY = "hc_live_testkey";

beforeEach(() => {
  useSchedulerEnvironment(T0);
  process.env.RESEND_API_KEY = "test-key";
});
afterEach(() => {
  delete process.env.RESEND_API_KEY;
  resetSchedulerEnvironment();
});

// Email and telegram both work for this user
async function seedUserWithEmailAndTelegram(): Promise<number> {
  const userId = await seedUser();
  await db
    .update(userSettings)
    .set({ notificationsEmail: true })
    .where(eq(userSettings.userId, userId));
  return userId;
}

async function seedAlertBucket(userId: number, medium: string[]): Promise<number> {
  const bucketId = await seedBucket(
    userId,
    { medium, repeat: "once" },
    { fields: [], notifyOnArrival: true, notifyWhenOverdue: true }
  );
  await db
    .update(buckets)
    .set({ webhookKey: encryptValue(KEY) })
    .where(eq(buckets.id, bucketId));
  return bucketId;
}

async function queuedMediums(userId: number): Promise<string[]> {
  const jobs = await db
    .select()
    .from(notificationQueue)
    .where(eq(notificationQueue.userId, userId));
  return jobs.map((j) => j.medium).sort();
}

function webhook(bucketId: number, title: string) {
  return postWebhook(
    new Request(`http://localhost/api/webhook/${bucketId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    }),
    { params: Promise.resolve({ bucketId: String(bucketId) }) }
  );
}

describe("overdue alerts", () => {
  it("go only to the bucket's channels", async () => {
    const userId = await seedUserWithEmailAndTelegram();
    const bucketId = await seedAlertBucket(userId, ["telegram"]);
    await seedItem(userId, bucketId, { deadline: T0, notifiedAt: T0 });

    await runSchedulerAt(new Date(T0.getTime() + 2 * HOUR));
    expect(await queuedMediums(userId)).toEqual(["telegram"]);
  });

  it("are not sent when the bucket has no channels", async () => {
    const userId = await seedUserWithEmailAndTelegram();
    const bucketId = await seedAlertBucket(userId, []);
    await seedItem(userId, bucketId, { deadline: T0, notifiedAt: T0 });

    await runSchedulerAt(new Date(T0.getTime() + 2 * HOUR));
    expect(await queuedMediums(userId)).toEqual([]);
  });
});

describe("arrival alerts", () => {
  it("go only to the bucket's channels", async () => {
    const userId = await seedUserWithEmailAndTelegram();
    const bucketId = await seedAlertBucket(userId, ["telegram"]);

    expect((await webhook(bucketId, "new order")).status).toBe(201);
    expect(await queuedMediums(userId)).toEqual(["telegram"]);
  });

  it("are not sent when the bucket has no channels", async () => {
    const userId = await seedUserWithEmailAndTelegram();
    const bucketId = await seedAlertBucket(userId, []);

    expect((await webhook(bucketId, "new order")).status).toBe(201);
    expect(await queuedMediums(userId)).toEqual([]);
  });
});

describe("deadline reminders", () => {
  it("skip email when no email provider is configured", async () => {
    delete process.env.RESEND_API_KEY;
    const userId = await seedUserWithEmailAndTelegram();
    const bucketId = await seedAlertBucket(userId, ["email", "telegram"]);
    await seedItem(userId, bucketId, { deadline: T0 });

    await runSchedulerAt(new Date(T0.getTime() + 60_000));
    expect(await queuedMediums(userId)).toEqual(["telegram"]);
  });
});

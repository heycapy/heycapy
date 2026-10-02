import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as SessionModule from "@/lib/auth/session";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, items, notificationQueue, userSettings } from "@/lib/db/schema";
import { encryptValue } from "@/lib/crypto";
import { POST as postWebhook } from "@/app/api/webhook/[bucketId]/route";
import { saveQuietHoursAction } from "@/app/(app)/user-settings-actions";
import {
  HOUR,
  resetSchedulerEnvironment,
  runSchedulerAt,
  seedBucket,
  seedItem,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

const session = vi.hoisted(() => ({ userId: 0, email: "" }));
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof SessionModule>()),
  getSession: async () => session,
}));

const T0 = new Date("2026-03-10T12:00:00Z");
const KEY = "hc_live_testkey";

beforeEach(() => useSchedulerEnvironment(T0));
afterEach(() => resetSchedulerEnvironment());

async function quietUser(from: string | null, to: string | null) {
  const userId = await seedUser();
  await db
    .update(userSettings)
    .set({ quietHoursFrom: from, quietHoursTo: to })
    .where(eq(userSettings.userId, userId));
  return userId;
}

describe("saving quiet hours", () => {
  it("accepts a start and an end, or neither", async () => {
    session.userId = await seedUser();
    expect(await saveQuietHoursAction("22:00", "07:00")).toEqual({ ok: true });
    expect(await saveQuietHoursAction(null, null)).toEqual({ ok: true });
  });

  it("refuses half-set, invalid or empty windows", async () => {
    session.userId = await seedUser();
    for (const [from, to] of [
      ["22:00", null],
      ["25:00", "07:00"],
      ["07:00", "07:00"],
    ] as const) {
      expect((await saveQuietHoursAction(from, to)).ok).toBe(false);
    }
  });

  it("moves reminders that already fall inside them", async () => {
    session.userId = await seedUser();
    const bucketId = await seedBucket(session.userId);
    const itemId = await seedItem(session.userId, bucketId, {
      deadline: new Date("2026-03-10T23:00:00Z"),
    });

    await saveQuietHoursAction("22:00", "07:00");

    const item = await db.query.items.findFirst({ where: eq(items.id, itemId) });
    expect(item?.nextReminderAt).toEqual(new Date("2026-03-11T07:00:00Z"));
  });
});

describe("new item alerts", () => {
  async function arrive(userId: number) {
    const bucketId = await seedBucket(
      userId,
      { medium: ["telegram"], repeat: "once" },
      { fields: [], notifyOnArrival: true }
    );
    await db
      .update(buckets)
      .set({ webhookKey: encryptValue(KEY) })
      .where(eq(buckets.id, bucketId));
    await postWebhook(
      new Request(`http://localhost/api/webhook/${bucketId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ title: "new order" }),
      }),
      { params: Promise.resolve({ bucketId: String(bucketId) }) }
    );
    const [job] = await db
      .select()
      .from(notificationQueue)
      .where(
        and(
          eq(notificationQueue.userId, userId),
          eq(notificationQueue.kind, "arrival"),
          eq(notificationQueue.medium, "telegram")
        )
      );
    return job;
  }

  it("wait until quiet hours end", async () => {
    const userId = await quietUser("10:00", "14:00");
    const job = await arrive(userId);
    expect(job?.status).toBe("pending");
    expect(job?.nextRetryAt).toEqual(new Date("2026-03-10T14:00:00Z"));

    await runSchedulerAt(new Date(T0.getTime() + HOUR));
    const held = await db.query.notificationQueue.findFirst({
      where: eq(notificationQueue.id, job?.id ?? 0),
    });
    expect(held?.status).toBe("pending");

    await runSchedulerAt(new Date("2026-03-10T14:00:30Z"));
    const sent = await db.query.notificationQueue.findFirst({
      where: eq(notificationQueue.id, job?.id ?? 0),
    });
    expect(sent?.status).toBe("sent");
  });

  it("go straight out otherwise", async () => {
    const job = await arrive(await quietUser(null, null));
    expect(job?.nextRetryAt).toBeNull();
    await runSchedulerAt(T0);
    const sent = await db.query.notificationQueue.findFirst({
      where: eq(notificationQueue.id, job?.id ?? 0),
    });
    expect(sent?.status).toBe("sent");
  });
});

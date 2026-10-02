import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, items } from "@/lib/db/schema";
import { executeToolCall } from "@/lib/ai/capyTools";
import {
  resetSchedulerEnvironment,
  seedBucket,
  seedItem,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

const QUIET = { from: "22:00", to: "07:00" };

beforeEach(() => {
  useSchedulerEnvironment(new Date("2026-03-10T12:00:00Z"));
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "integration-not-used");
});
afterEach(() => {
  resetSchedulerEnvironment();
  vi.unstubAllEnvs();
});

type Settings = Record<string, unknown>;

async function tool(userId: number, name: string, args: Record<string, unknown>) {
  const result = await executeToolCall({ id: "call", name, arguments: args }, userId);
  return JSON.parse(result) as { ok: boolean; error?: string; settings?: Settings };
}

async function seedSubscriptions() {
  const userId = await seedUser();
  const bucketId = await seedBucket(userId, {
    medium: ["telegram"],
    repeat: "once",
    notifyAt: "09:00",
    quietHours: QUIET,
  });
  return { userId, bucketId };
}

async function storedNotificationRules(bucketId: number): Promise<Settings> {
  const bucket = await db.query.buckets.findFirst({ where: eq(buckets.id, bucketId) });
  return JSON.parse(bucket?.notificationsRules ?? "{}") as Settings;
}

describe("get_bucket_settings", () => {
  it("shows the settings and which channels actually work", async () => {
    const { userId, bucketId } = await seedSubscriptions();
    await tool(userId, "update_bucket_settings", {
      bucket_id: bucketId,
      channels: ["telegram", "email"],
    });

    const { settings } = await tool(userId, "get_bucket_settings", { bucket_id: bucketId });

    expect(settings).toMatchObject({
      channels: ["telegram", "email"],
      working_channels: ["telegram"],
      channels_not_working: ["email"],
      remind_at: "09:00",
      deadline_repeat: "once",
    });
  });

  it("doesn't show another user's bucket", async () => {
    const { bucketId } = await seedSubscriptions();
    const stranger = await seedUser();

    expect(await tool(stranger, "get_bucket_settings", { bucket_id: bucketId })).toEqual({
      ok: false,
      error: "Bucket not found",
    });
  });
});

describe("update_bucket_settings", () => {
  it("changes only what it's given and keeps quiet hours", async () => {
    const { userId, bucketId } = await seedSubscriptions();

    const result = await tool(userId, "update_bucket_settings", {
      bucket_id: bucketId,
      sort_by: "manual",
      allow_drag: true,
    });

    expect(result.settings).toMatchObject({
      sort_by: "manual",
      allow_drag: true,
      channels: ["telegram"],
      remind_at: "09:00",
    });
    expect((await storedNotificationRules(bucketId)).quietHours).toEqual(QUIET);
  });

  it("re-schedules items that follow the bucket's default reminders", async () => {
    const { userId, bucketId } = await seedSubscriptions();
    const deadline = new Date("2026-03-13T15:00:00Z");
    const itemId = await seedItem(userId, bucketId, { deadline });

    await tool(userId, "update_bucket_settings", {
      bucket_id: bucketId,
      default_reminders_mins: [1440],
    });

    const item = await db.query.items.findFirst({ where: eq(items.id, itemId) });
    expect(item?.nextReminderAt).toEqual(new Date("2026-03-12T15:00:00Z"));
  });

  it("turns on overdue alerts with a first alert delay", async () => {
    const { userId, bucketId } = await seedSubscriptions();

    const { settings } = await tool(userId, "update_bucket_settings", {
      bucket_id: bucketId,
      notify_when_overdue: true,
      overdue_first_alert_mins: 60,
    });

    expect(settings).toMatchObject({
      notify_when_overdue: true,
      overdue_first_alert_mins: 60,
      overdue_repeat_hours: null,
    });
  });

  it("clears remind at with null", async () => {
    const { userId, bucketId } = await seedSubscriptions();

    await tool(userId, "update_bucket_settings", { bucket_id: bucketId, remind_at: null });

    expect(await storedNotificationRules(bucketId)).not.toHaveProperty("notifyAt");
  });

  it.each([
    ["an unknown channel", { channels: ["sms"] }, "Invalid channels"],
    ["a time that doesn't exist", { remind_at: "25:00" }, "Invalid remind at"],
    ["an unknown sort", { sort_by: "random" }, "Invalid sort by"],
    ["too many reminders", { default_reminders_mins: [0, 5, 10, 15, 30] }, "Invalid reminders"],
  ])("refuses %s and saves nothing", async (_, args, error) => {
    const { userId, bucketId } = await seedSubscriptions();
    const before = await db.query.buckets.findFirst({ where: eq(buckets.id, bucketId) });

    expect(await tool(userId, "update_bucket_settings", { bucket_id: bucketId, ...args })).toEqual({
      ok: false,
      error,
    });

    const after = await db.query.buckets.findFirst({ where: eq(buckets.id, bucketId) });
    expect(after?.notificationsRules).toBe(before?.notificationsRules);
    expect(after?.itemsRules).toBe(before?.itemsRules);
  });
});

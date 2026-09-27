import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, items, notificationQueue, templates, userSettings } from "@/lib/db/schema";
import { createBucketAction } from "@/app/(app)/bucket-actions";
import { executeToolCall } from "@/lib/ai/capyTools";
import { enqueue, processPending } from "@/lib/notifications/queue";
import { refreshItemReminders } from "@/lib/reminders/refresh";
import { getWorkingChannels } from "@/lib/notifications/channels";
import { resetSchedulerEnvironment, seedUser, useSchedulerEnvironment } from "./helpers";

const session = vi.hoisted(() => ({ userId: 0 }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => session }));

beforeEach(() => {
  useSchedulerEnvironment(new Date("2026-03-10T12:00:00Z"));
  delete process.env.RESEND_API_KEY;
  delete process.env.SMTP_HOST;
  delete process.env.E2E_TEST_MODE;
});
afterEach(() => resetSchedulerEnvironment());

async function signIn(): Promise<number> {
  session.userId = await seedUser();
  return session.userId;
}

async function seedTemplate(medium: string[]): Promise<number> {
  const [template] = await db
    .insert(templates)
    .values({
      name: `Template ${Math.random()}`,
      rulesJson: JSON.stringify({ notifications: { medium, repeat: "once" }, items: {} }),
      isBuiltin: true,
    })
    .returning();
  return template.id;
}

async function bucketMedium(bucketId: number): Promise<unknown> {
  const bucket = await db.query.buckets.findFirst({ where: eq(buckets.id, bucketId) });
  return (JSON.parse(bucket?.notificationsRules ?? "{}") as { medium?: unknown }).medium;
}

describe("new buckets get working channels by default", () => {
  it("a template without channels (like Blank) uses the user's working channels", async () => {
    await signIn();
    const result = await createBucketAction(await seedTemplate([]), `Blank ${Math.random()}`);
    expect(result.ok && (await bucketMedium(result.bucketId))).toEqual(["telegram"]);
  });

  it("a template that lists channels keeps them", async () => {
    await signIn();
    const result = await createBucketAction(await seedTemplate(["email"]), `Work ${Math.random()}`);
    expect(result.ok && (await bucketMedium(result.bucketId))).toEqual(["email"]);
  });

  it("buckets created by the assistant use the user's working channels", async () => {
    const userId = await signIn();
    const result = JSON.parse(
      await executeToolCall(
        { id: "c", name: "create_bucket", arguments: { name: `AI ${Math.random()}` } },
        userId
      )
    ) as { ok: boolean; bucketId: number };
    expect(await bucketMedium(result.bucketId)).toEqual(["telegram"]);
  });
});

describe("a bucket with no channel list", () => {
  it("sends no reminders, matching what the settings screen shows", async () => {
    const userId = await signIn();
    const [bucket] = await db
      .insert(buckets)
      .values({ userId, name: `Legacy ${Math.random()}`, notificationsRules: "{}" })
      .returning();
    const [item] = await db
      .insert(items)
      .values({ bucketId: bucket.id, userId, title: "x", deadline: new Date("2026-03-11") })
      .returning();
    await refreshItemReminders([item.id]);

    const stored = await db.query.items.findFirst({ where: eq(items.id, item.id) });
    expect(stored?.nextReminderAt).toBeNull();
  });
});

describe("E2E test mode", () => {
  it("never delivers notifications outside the server", async () => {
    const userId = await signIn();
    await db
      .update(userSettings)
      .set({ notificationsTelegram: true })
      .where(eq(userSettings.userId, userId));
    process.env.E2E_TEST_MODE = "1";

    await enqueue({ userId, medium: "telegram", title: "t", message: "m" });
    await processPending();

    expect(fetch).not.toHaveBeenCalled();
    const jobs = await db
      .select()
      .from(notificationQueue)
      .where(eq(notificationQueue.userId, userId));
    expect(jobs.map((j) => j.status)).toEqual(["sent"]);
  });
});

describe("working channels", () => {
  async function userWith(settings: Partial<typeof userSettings.$inferInsert>) {
    const userId = await signIn();
    await db
      .update(userSettings)
      .set({
        notificationsEmail: false,
        notificationsPush: false,
        notificationsTelegram: false,
        ...settings,
      })
      .where(eq(userSettings.userId, userId));
    return userId;
  }

  it("email needs the toggle and a configured sender", async () => {
    const userId = await userWith({ notificationsEmail: true });
    expect(await getWorkingChannels(userId)).toEqual([]);

    process.env.RESEND_API_KEY = "test-key";
    expect(await getWorkingChannels(userId)).toEqual(["email"]);

    const smtpUser = await userWith({
      notificationsEmail: true,
      emailProvider: "smtp",
      smtpHost: "smtp.example.com",
    });
    delete process.env.RESEND_API_KEY;
    expect(await getWorkingChannels(smtpUser)).toEqual(["email"]);
  });

  it("ntfy needs the toggle, a server url and a topic", async () => {
    expect(await getWorkingChannels(await userWith({ notificationsPush: true }))).toEqual([]);
    const configured = await userWith({
      notificationsPush: true,
      ntfyUrl: "https://ntfy.sh",
      ntfyTopic: "heycapy",
    });
    expect(await getWorkingChannels(configured)).toEqual(["ntfy"]);
  });

  it("telegram needs the toggle, a connected chat and the bot token", async () => {
    const userId = await userWith({ notificationsTelegram: true, telegramChatId: "42" });
    expect(await getWorkingChannels(userId)).toEqual(["telegram"]);

    delete process.env.TELEGRAM_BOT_TOKEN;
    expect(await getWorkingChannels(userId)).toEqual([]);
  });

  it("a channel that is turned off never counts", async () => {
    process.env.RESEND_API_KEY = "test-key";
    const userId = await userWith({
      telegramChatId: "42",
      ntfyUrl: "https://ntfy.sh",
      ntfyTopic: "heycapy",
    });
    expect(await getWorkingChannels(userId)).toEqual([]);
  });
});

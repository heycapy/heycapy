import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notificationQueue, userSettings } from "@/lib/db/schema";
import { getWorkingChannels } from "@/lib/notifications/channels";
import { sendNotificationEmail } from "@/lib/notifications/email";
import {
  resetSchedulerEnvironment,
  runSchedulerAt,
  seedBucket,
  seedItem,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

const send = vi.hoisted(() => vi.fn(async () => ({ data: { id: "1" }, error: null })));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

const sendMail = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock("nodemailer", () => ({ createTransport: () => ({ sendMail }) }));

const T0 = new Date("2026-03-10T12:00:00Z");

beforeEach(() => {
  useSchedulerEnvironment(T0);
  process.env.RESEND_API_KEY = "test-key";
  delete process.env.SMTP_HOST;
  send.mockClear();
  sendMail.mockClear();
});
afterEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.SMTP_HOST;
  resetSchedulerEnvironment();
});

async function emailUser(settings: Partial<typeof userSettings.$inferInsert> = {}) {
  const userId = await seedUser();
  await db
    .update(userSettings)
    .set({ notificationsEmail: true, ...settings })
    .where(eq(userSettings.userId, userId));
  const bucketId = await seedBucket(userId, { medium: ["email"], repeat: "once" });
  await seedItem(userId, bucketId, { deadline: new Date(T0.getTime() + 60_000) });
  return userId;
}

async function emailJobs(userId: number) {
  return db.select().from(notificationQueue).where(eq(notificationQueue.userId, userId));
}

describe("reminder emails never go through the hosted resend account", () => {
  it("a user without their own smtp gets no reminder email, and email doesn't count as working", async () => {
    const userId = await emailUser();

    expect(await getWorkingChannels(userId)).not.toContain("email");
    await runSchedulerAt(new Date(T0.getTime() + 2 * 60_000));

    expect(send).not.toHaveBeenCalled();
    expect(
      (await emailJobs(userId)).filter((j) => j.medium === "email" && j.status === "sent")
    ).toEqual([]);
  });

  it("a user with their own smtp gets reminders through it", async () => {
    const userId = await emailUser({ emailProvider: "smtp", smtpHost: "203.0.113.10" });

    expect(await getWorkingChannels(userId)).toContain("email");
    await runSchedulerAt(new Date(T0.getTime() + 2 * 60_000));

    expect(sendMail).toHaveBeenCalledOnce();
    expect(send).not.toHaveBeenCalled();
  });

  it("a self-hosted server's own smtp still sends reminders", async () => {
    process.env.SMTP_HOST = "smtp.self-hosted.test";
    const userId = await emailUser();

    expect(await getWorkingChannels(userId)).toContain("email");
    await runSchedulerAt(new Date(T0.getTime() + 2 * 60_000));

    expect(sendMail).toHaveBeenCalledOnce();
    expect(send).not.toHaveBeenCalled();
  });

  it("the sender itself refuses resend, for a reminder queued before someone removed their smtp", async () => {
    await expect(
      sendNotificationEmail({ to: "someone@heycapy.test", subject: "pay rent", text: "pay rent" })
    ).rejects.toThrow("your own email account");
    expect(send).not.toHaveBeenCalled();
  });
});

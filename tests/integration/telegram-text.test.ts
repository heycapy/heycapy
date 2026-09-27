import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
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

beforeEach(() => useSchedulerEnvironment(T0));
afterEach(() => resetSchedulerEnvironment());

function sentTelegramTexts(): string[] {
  return vi
    .mocked(fetch)
    .mock.calls.filter(([url]) => String(url).endsWith("/sendMessage"))
    .map(([, init]) => (JSON.parse(String(init?.body)) as { text: string }).text);
}

it("a telegram reminder names the item", async () => {
  const userId = await seedUser();
  const bucketId = await seedBucket(userId);
  await seedItem(userId, bucketId, { deadline: T0, title: "renew passport" });

  await runSchedulerAt(T0);

  expect(sentTelegramTexts()).toEqual([expect.stringContaining("renew passport")]);
});

it("a telegram reminder names the item when AI-written messages are off", async () => {
  const userId = await seedUser();
  await db
    .update(userSettings)
    .set({ aiNotifyMessages: false })
    .where(eq(userSettings.userId, userId));
  const bucketId = await seedBucket(userId);
  await seedItem(userId, bucketId, { deadline: T0, title: "renew passport" });

  await runSchedulerAt(T0);

  expect(sentTelegramTexts()).toEqual([expect.stringContaining("renew passport")]);
});

it("a telegram overdue alert names the item", async () => {
  const userId = await seedUser();
  const bucketId = await seedBucket(
    userId,
    { medium: ["telegram"], repeat: "once" },
    { fields: [], notifyWhenOverdue: true }
  );
  await seedItem(userId, bucketId, {
    deadline: new Date(T0.getTime() - 2 * HOUR),
    notifiedAt: new Date(T0.getTime() - 2 * HOUR),
    title: "renew passport",
  });

  await runSchedulerAt(T0);

  expect(sentTelegramTexts()).toEqual([expect.stringContaining("renew passport")]);
});

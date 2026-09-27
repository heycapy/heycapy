import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { notificationQueue } from "@/lib/db/schema";
import { dataEvents } from "@/lib/events";
import { dismissChannelFailures, getChannelFailures } from "@/lib/notifications/failures";
import { enqueue, processPending } from "@/lib/notifications/queue";
import type { NotificationMedium } from "@/lib/notifications/queue";
import {
  HOUR,
  resetSchedulerEnvironment,
  seedBucket,
  seedItem,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

const NOW = new Date("2026-03-10T12:00:00Z");

beforeEach(() => useSchedulerEnvironment(NOW));
afterEach(() => resetSchedulerEnvironment());

async function seedJob(
  userId: number,
  medium: NotificationMedium,
  status: "sent" | "dead",
  opts: { itemId?: number; hoursAgo?: number; error?: string } = {}
) {
  await db.insert(notificationQueue).values({
    userId,
    itemId: opts.itemId ?? null,
    medium,
    title: "[heycapy] reminder",
    message: "m",
    status,
    lastError: status === "dead" ? (opts.error ?? "boom") : null,
    createdAt: new Date(NOW.getTime() - (opts.hoursAgo ?? 1) * HOUR),
  });
}

it("groups failed deliveries by channel, newest first, with item and bucket", async () => {
  const userId = await seedUser();
  const bucketId = await seedBucket(userId);
  const itemId = await seedItem(userId, bucketId, { deadline: NOW, title: "pay rent" });
  await seedJob(userId, "telegram", "dead", { itemId, hoursAgo: 3, error: "old" });
  await seedJob(userId, "telegram", "dead", { hoursAgo: 2, error: "bot was blocked" });
  await seedJob(userId, "email", "sent");

  const failures = await getChannelFailures(userId, NOW);

  expect(failures).toHaveLength(1);
  expect(failures[0].medium).toBe("telegram");
  expect(failures[0].deliveries.map((d) => d.error)).toEqual(["bot was blocked", "old"]);
  expect(failures[0].deliveries[1]).toMatchObject({ title: "pay rent" });
  expect(failures[0].deliveries[1].bucketName).toMatch(/^Bucket /);
  expect(failures[0].deliveries[0]).toMatchObject({
    title: "[heycapy] reminder",
    bucketName: null,
  });
});

it("a later successful delivery on the channel clears its earlier failures", async () => {
  const userId = await seedUser();
  await seedJob(userId, "ntfy", "dead", { hoursAgo: 2 });
  await seedJob(userId, "ntfy", "sent", { hoursAgo: 1 });

  expect(await getChannelFailures(userId, NOW)).toEqual([]);
});

it("failures older than 7 days are not shown", async () => {
  const userId = await seedUser();
  await seedJob(userId, "email", "dead", { hoursAgo: 7 * 24 + 1 });

  expect(await getChannelFailures(userId, NOW)).toEqual([]);
});

it("only the user's own failures are shown", async () => {
  const userId = await seedUser();
  const other = await seedUser();
  await seedJob(other, "telegram", "dead");

  expect(await getChannelFailures(userId, NOW)).toEqual([]);
});

it("a delivery that gives up tells open pages to refresh, a retry does not", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("blocked", { status: 403 }))
  );
  const userId = await seedUser();
  const refreshed = vi.fn();
  dataEvents.on("refresh", refreshed);

  await enqueue({ userId, medium: "telegram", title: "t", message: "m", maxAttempts: 2 });
  await processPending();
  expect(refreshed).not.toHaveBeenCalled();

  vi.setSystemTime(new Date(NOW.getTime() + HOUR));
  await processPending();
  expect(refreshed).toHaveBeenCalledWith(userId);
  dataEvents.off("refresh", refreshed);
});

it("dismissing a channel hides its current failures but not later ones", async () => {
  const userId = await seedUser();
  await seedJob(userId, "telegram", "dead", { hoursAgo: 3 });
  await seedJob(userId, "email", "dead", { hoursAgo: 3 });

  await dismissChannelFailures(userId, "telegram");
  expect((await getChannelFailures(userId, NOW)).map((f) => f.medium)).toEqual(["email"]);

  await seedJob(userId, "telegram", "dead", { hoursAgo: 1, error: "new" });
  const telegram = (await getChannelFailures(userId, NOW)).find((f) => f.medium === "telegram");
  expect(telegram?.deliveries.map((d) => d.error)).toEqual(["new"]);
});

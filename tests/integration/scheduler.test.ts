import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { reconcile } from "@/lib/reminders/refresh";
import {
  HOUR,
  MINUTE,
  remindersQueued,
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

/** Old items that were already reminded once and never completed — they pile up over time. */
async function seedStaleBacklog(userId: number, bucketId: number, count: number) {
  const past = new Date(T0.getTime() - 30 * 24 * HOUR);
  await db.insert(items).values(
    Array.from({ length: count }, (_, i) => ({
      bucketId,
      userId,
      title: `old bill ${i}`,
      deadline: past,
      notifiedAt: past,
    }))
  );
  // Existing rows get their reminder times from the startup reconciliation
  await reconcile();
}

describe("large backlogs", () => {
  it("still reminds about a due item when hundreds of stale items exist", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);
    await seedStaleBacklog(userId, bucketId, 600);
    const due = await seedItem(userId, bucketId, { deadline: T0, title: "renew passport" });

    await runSchedulerAt(new Date(T0.getTime() + MINUTE));
    expect(await remindersQueued(due)).toBe(1);
  });

  it("one user's backlog does not block another user's reminders", async () => {
    const heavy = await seedUser();
    await seedStaleBacklog(heavy, await seedBucket(heavy), 600);

    const other = await seedUser();
    const due = await seedItem(other, await seedBucket(other), { deadline: T0 });

    await runSchedulerAt(new Date(T0.getTime() + MINUTE));
    expect(await remindersQueued(due)).toBe(1);
  });

  it("still sends overdue alerts when many overdue items have alerts turned off", async () => {
    const userId = await seedUser();
    const noAlerts = await seedBucket(userId);
    await seedStaleBacklog(userId, noAlerts, 300);

    const withAlerts = await seedBucket(
      userId,
      { medium: ["telegram"], repeat: "once" },
      { fields: [], notifyWhenOverdue: true }
    );
    const overdue = await seedItem(userId, withAlerts, {
      deadline: new Date(T0.getTime() - 2 * HOUR),
      notifiedAt: new Date(T0.getTime() - 2 * HOUR),
    });

    await runSchedulerAt(T0);
    expect(await remindersQueued(overdue)).toBe(1);
  });
});

describe("daily repeat", () => {
  it("repeats once per day in the user's timezone, not per UTC day", async () => {
    // 9:00 in New York is 13:00 UTC (EDT); 20:30 the same evening is 00:30 UTC the next day
    const userId = await seedUser("America/New_York");
    const bucketId = await seedBucket(userId, { medium: ["telegram"], repeat: "daily" });
    const deadline = new Date("2026-06-10T13:00:00Z");
    const itemId = await seedItem(userId, bucketId, { deadline });

    await runSchedulerAt(new Date("2026-06-10T13:01:00Z"));
    expect(await remindersQueued(itemId)).toBe(1);

    await runSchedulerAt(new Date("2026-06-11T00:30:00Z"));
    expect(await remindersQueued(itemId)).toBe(1);

    await runSchedulerAt(new Date("2026-06-11T13:01:00Z"));
    expect(await remindersQueued(itemId)).toBe(2);
  });
});

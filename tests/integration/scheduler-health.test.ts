import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notificationQueue } from "@/lib/db/schema";
import { enqueue, processPending } from "@/lib/notifications/queue";
import { runNotifications, schedulerHealth } from "@/lib/scheduler";
import { MINUTE, resetSchedulerEnvironment, seedUser, useSchedulerEnvironment } from "./helpers";

const T0 = new Date("2026-03-10T12:00:00Z");

beforeEach(() => useSchedulerEnvironment(T0));
afterEach(() => resetSchedulerEnvironment());

it("a delivery that never answers fails after its deadline instead of blocking the run", async () => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout"] });
  vi.setSystemTime(T0);
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise<Response>(() => {}))
  );
  const userId = await seedUser();
  await enqueue({ userId, medium: "telegram", title: "t", message: "m" });

  const run = processPending();
  await vi.advanceTimersByTimeAsync(30_000);
  await run;

  const [job] = await db
    .select()
    .from(notificationQueue)
    .where(eq(notificationQueue.userId, userId));
  expect(job.status).toBe("pending");
  expect(job.lastError).toContain("telegram delivery timed out after 30s");
});

it("reports stale until a run finishes, fresh after, stale again after five quiet minutes", async () => {
  expect(schedulerHealth(T0).stale).toBe(true);

  await runNotifications();

  const lastRun = schedulerHealth(T0).lastRunAt;
  expect(lastRun).toEqual(T0);
  expect(schedulerHealth(new Date(T0.getTime() + 4 * MINUTE)).stale).toBe(false);
  expect(schedulerHealth(new Date(T0.getTime() + 6 * MINUTE)).stale).toBe(true);
});

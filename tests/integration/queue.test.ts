import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notificationQueue } from "@/lib/db/schema";
import { enqueue, processPending } from "@/lib/notifications/queue";
import { resetSchedulerEnvironment, seedUser, useSchedulerEnvironment } from "./helpers";

const T0 = new Date("2026-03-10T12:00:00Z");

beforeEach(() => useSchedulerEnvironment(T0));
afterEach(() => resetSchedulerEnvironment());

function slowTelegramApi() {
  const api = vi.fn(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
    return new Response("{}", { status: 200 });
  });
  vi.stubGlobal("fetch", api);
  return api;
}

async function jobsFor(userId: number) {
  return db.select().from(notificationQueue).where(eq(notificationQueue.userId, userId));
}

describe("notification queue", () => {
  it("overlapping runs (scheduler + webhook) send each notification once", async () => {
    const api = slowTelegramApi();
    const userId = await seedUser();
    await enqueue({ userId, medium: "telegram", title: "t", message: "pay rent" });

    await Promise.all([processPending(), processPending(), processPending()]);

    expect(api).toHaveBeenCalledTimes(1);
    expect((await jobsFor(userId)).map((j) => j.status)).toEqual(["sent"]);
  });

  it("a job left 'sending' by a crash is delivered once its claim expires", async () => {
    const api = slowTelegramApi();
    const userId = await seedUser();
    await enqueue({ userId, medium: "telegram", title: "t", message: "pay rent" });
    await db
      .update(notificationQueue)
      .set({ status: "sending" })
      .where(eq(notificationQueue.userId, userId));

    vi.setSystemTime(new Date(T0.getTime() + 60 * 60 * 1000));
    await processPending();

    expect(api).toHaveBeenCalledTimes(1);
    expect((await jobsFor(userId)).map((j) => j.status)).toEqual(["sent"]);
  });

  it("a job another run is currently sending is left alone", async () => {
    const api = slowTelegramApi();
    const userId = await seedUser();
    await enqueue({ userId, medium: "telegram", title: "t", message: "pay rent" });

    const first = processPending();
    await vi.waitFor(() => expect(api).toHaveBeenCalledTimes(1));
    await processPending();
    await first;

    expect(api).toHaveBeenCalledTimes(1);
  });
});

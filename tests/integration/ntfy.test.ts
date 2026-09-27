import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notificationQueue, userSettings } from "@/lib/db/schema";
import { enqueue, processPending } from "@/lib/notifications/queue";
import { resetSchedulerEnvironment, seedUser, useSchedulerEnvironment } from "./helpers";

beforeEach(() => useSchedulerEnvironment(new Date("2026-03-10T12:00:00Z")));
afterEach(() => resetSchedulerEnvironment());

it("an ntfy server that rejects the message is a failed delivery, not a sent one", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("unauthorized", { status: 403 }))
  );
  const userId = await seedUser();
  await db
    .update(userSettings)
    .set({ notificationsPush: true, ntfyUrl: "https://ntfy.example.com", ntfyTopic: "heycapy" })
    .where(eq(userSettings.userId, userId));

  await enqueue({ userId, medium: "ntfy", title: "t", message: "m" });
  await processPending();

  const [job] = await db
    .select()
    .from(notificationQueue)
    .where(eq(notificationQueue.userId, userId));
  expect(job.status).toBe("pending");
  expect(job.lastError).toContain("403");
});

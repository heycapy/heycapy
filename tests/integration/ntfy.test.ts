import { afterEach, beforeEach, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notificationQueue, userSettings } from "@/lib/db/schema";
import { enqueue, processPending } from "@/lib/notifications/queue";
import { resetSchedulerEnvironment, seedUser, useSchedulerEnvironment } from "./helpers";
import { startNtfyServer, type NtfyServer } from "./ntfy-server";

let ntfy: NtfyServer;
beforeEach(async () => {
  useSchedulerEnvironment(new Date("2026-03-10T12:00:00Z"));
  ntfy = await startNtfyServer();
});
afterEach(async () => {
  resetSchedulerEnvironment();
  await ntfy.close();
});

it("an ntfy server that rejects the message is a failed delivery, not a sent one", async () => {
  ntfy.reply(403, "unauthorized");
  const userId = await seedUser();
  await db
    .update(userSettings)
    .set({ notificationsPush: true, ntfyUrl: ntfy.url, ntfyTopic: "heycapy" })
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

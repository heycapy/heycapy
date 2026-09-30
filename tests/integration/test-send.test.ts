import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notificationQueue, userSettings } from "@/lib/db/schema";
import { sendTestNotificationAction } from "@/app/(app)/user-settings-actions";
import { getChannelFailures } from "@/lib/notifications/failures";
import { resetSchedulerEnvironment, seedUser, useSchedulerEnvironment } from "./helpers";
import { startNtfyServer, type NtfyServer } from "./ntfy-server";

const session = vi.hoisted(() => ({ userId: 0, email: "" }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => session }));

let ntfy: NtfyServer;
beforeEach(async () => {
  useSchedulerEnvironment(new Date("2026-03-10T12:00:00Z"));
  delete process.env.E2E_TEST_MODE;
  session.userId = await seedUser();
  ntfy = await startNtfyServer();
});
afterEach(async () => {
  resetSchedulerEnvironment();
  await ntfy.close();
});

function stubFetch(status: number, body = "{}") {
  const fetchMock = vi.fn(async () => new Response(body, { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

it("ntfy test posts to the entered server and topic", async () => {
  const result = await sendTestNotificationAction("ntfy", { url: `${ntfy.url}/`, topic: "capy" });
  expect(result).toEqual({ ok: true });
  expect(ntfy.bodies).toEqual([expect.objectContaining({ topic: "capy" })]);
});

it("ntfy test reports the server's rejection", async () => {
  ntfy.reply(403, "forbidden");
  const result = await sendTestNotificationAction("ntfy", { url: ntfy.url, topic: "capy" });
  expect(result).toEqual({ ok: false, error: expect.stringContaining("403") });
});

it("ntfy test rejects a missing topic or a non-http url without sending", async () => {
  expect(await sendTestNotificationAction("ntfy", { url: ntfy.url, topic: " " })).toMatchObject({
    ok: false,
  });
  expect(
    await sendTestNotificationAction("ntfy", { url: "file:///etc/passwd", topic: "capy" })
  ).toMatchObject({ ok: false });
  expect(ntfy.bodies).toEqual([]);
});

it("telegram test needs a connected chat", async () => {
  await db
    .update(userSettings)
    .set({ telegramChatId: null })
    .where(eq(userSettings.userId, session.userId));
  const fetchMock = stubFetch(200);
  expect(await sendTestNotificationAction("telegram")).toEqual({
    ok: false,
    error: "connect telegram first",
  });
  expect(fetchMock).not.toHaveBeenCalled();
});

it("telegram test sends to the connected chat and reports failures", async () => {
  stubFetch(200, JSON.stringify({ ok: true, result: { message_id: 1 } }));
  expect(await sendTestNotificationAction("telegram")).toEqual({ ok: true });

  stubFetch(403, JSON.stringify({ ok: false, description: "bot was blocked by the user" }));
  expect(await sendTestNotificationAction("telegram")).toMatchObject({ ok: false });
});

it("a successful test clears that channel's failure banner, a failed one keeps it", async () => {
  await db.insert(notificationQueue).values({
    userId: session.userId,
    medium: "telegram",
    title: "t",
    message: "m",
    status: "dead",
    lastError: "bot was blocked",
    createdAt: new Date(Date.now() - 60_000),
  });

  stubFetch(403, JSON.stringify({ ok: false, description: "bot was blocked by the user" }));
  await sendTestNotificationAction("telegram");
  expect(await getChannelFailures(session.userId)).toHaveLength(1);

  stubFetch(200, JSON.stringify({ ok: true, result: { message_id: 1 } }));
  await sendTestNotificationAction("telegram");
  expect(await getChannelFailures(session.userId)).toEqual([]);
});

import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { sendTestNotificationAction } from "@/app/(app)/user-settings-actions";
import { resetSchedulerEnvironment, seedUser, useSchedulerEnvironment } from "./helpers";

const session = vi.hoisted(() => ({ userId: 0 }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => session }));

beforeEach(async () => {
  useSchedulerEnvironment(new Date("2026-03-10T12:00:00Z"));
  delete process.env.E2E_TEST_MODE;
  session.userId = await seedUser();
});
afterEach(() => resetSchedulerEnvironment());

function stubFetch(status: number, body = "{}") {
  const fetchMock = vi.fn(async () => new Response(body, { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

it("ntfy test posts to the entered server and topic", async () => {
  const fetchMock = stubFetch(200);
  const result = await sendTestNotificationAction("ntfy", {
    url: "https://ntfy.example.com/",
    topic: "capy",
  });
  expect(result).toEqual({ ok: true });
  expect(fetchMock).toHaveBeenCalledWith("https://ntfy.example.com/capy", expect.anything());
});

it("ntfy test reports the server's rejection", async () => {
  stubFetch(403, "forbidden");
  const result = await sendTestNotificationAction("ntfy", {
    url: "https://ntfy.example.com",
    topic: "capy",
  });
  expect(result).toEqual({ ok: false, error: expect.stringContaining("403") });
});

it("ntfy test rejects a missing topic or a non-http url without sending", async () => {
  const fetchMock = stubFetch(200);
  expect(
    await sendTestNotificationAction("ntfy", { url: "https://ntfy.example.com", topic: " " })
  ).toMatchObject({ ok: false });
  expect(
    await sendTestNotificationAction("ntfy", { url: "file:///etc/passwd", topic: "capy" })
  ).toMatchObject({ ok: false });
  expect(fetchMock).not.toHaveBeenCalled();
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

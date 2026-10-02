import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { systemErrors } from "@/lib/db/schema";
import { POST } from "@/app/api/telegram/route";
import { createTelegramLinkAction } from "@/app/(app)/user-settings-actions";
import { telegramWebhookSecret } from "@/lib/notifications/telegram-webhook";
import {
  resetSchedulerEnvironment,
  seedBucket,
  seedItem,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";
import { callsTo, connectOwnChat, stubTelegram } from "./telegram-helpers";

const session = vi.hoisted(() => ({ userId: 0, email: "" }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => session }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "app.example.com" }) }));

const T0 = new Date("2026-03-10T12:00:00Z");

beforeEach(() => useSchedulerEnvironment(T0));
afterEach(() => resetSchedulerEnvironment());

const update = JSON.stringify({ message: { text: "/help", chat: { id: 1 } } });

function post(url: string, headers: Record<string, string> = {}) {
  return POST(new Request(url, { method: "POST", headers, body: update }));
}

it("refuses updates without the secret header, including the old secret-in-URL form", async () => {
  expect((await post("http://localhost/api/telegram")).status).toBe(403);
  expect(
    (await post("http://localhost/api/telegram", { "X-Telegram-Bot-Api-Secret-Token": "nope" }))
      .status
  ).toBe(403);
  expect((await post("http://localhost/api/telegram?secret=test-token")).status).toBe(403);
});

it("answers 200 even when handling an update fails, so later updates aren't held back", async () => {
  const api = stubTelegram();
  api.mockImplementation(async (url: string | URL | Request) =>
    String(url).endsWith("/editMessageText")
      ? new Response('{"ok":false,"description":"message to edit not found"}', { status: 400 })
      : new Response('{"ok":true,"result":{"message_id":1}}', { status: 200 })
  );
  const userId = await seedUser();
  const bucketId = await seedBucket(userId);
  const itemId = await seedItem(userId, bucketId, { deadline: T0 });
  const chat = await connectOwnChat(userId);

  const res = await POST(
    new Request("http://localhost/api/telegram", {
      method: "POST",
      headers: { "X-Telegram-Bot-Api-Secret-Token": telegramWebhookSecret("test-token") },
      body: JSON.stringify({
        callback_query: {
          id: "cb",
          data: `qc:${itemId}`,
          message: { message_id: 7, chat: { id: chat } },
        },
      }),
    })
  );

  expect(res.status).toBe(200);
  expect(callsTo(api, "editMessageText")).toHaveLength(1);
  const [logged] = await db.select().from(systemErrors).where(eq(systemErrors.source, "telegram"));
  expect(JSON.parse(logged.details ?? "{}")).toMatchObject({
    context: { kind: "button", button: `qc:${itemId}`, chatId: chat, messageId: 7 },
  });
});

it("connect registers the webhook with a header secret and no secret in the URL", async () => {
  process.env.APP_URL = "https://app.example.com";
  const api = stubTelegram();
  api.mockImplementation(
    async () => new Response('{"ok":true,"result":{"username":"heycapy_bot"}}', { status: 200 })
  );
  session.userId = await seedUser();

  await createTelegramLinkAction();

  const [registration] = callsTo(api, "setWebhook");
  expect(registration).toEqual({
    url: "https://app.example.com/api/telegram",
    secret_token: telegramWebhookSecret("test-token"),
  });
  delete process.env.APP_URL;
});

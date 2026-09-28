import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { items, userSettings } from "@/lib/db/schema";
import { ITEM_STATUS } from "@/constants";
import { enqueue, processPending } from "@/lib/notifications/queue";
import { verifyReminderAction } from "@/lib/reminders/action-token";
import { confirmReminderAction } from "@/app/(public)/r/[token]/actions";
import {
  HOUR,
  resetSchedulerEnvironment,
  seedBucket,
  seedItem,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

const sendEmail = vi.hoisted(() => vi.fn());
vi.mock("@/lib/notifications/email", () => ({ sendEmail }));

const T0 = new Date("2026-03-10T12:00:00Z");
const APP = "https://app.heycapy.test";

const saved = { secret: process.env.JWT_SECRET, appUrl: process.env.APP_URL };
beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-at-least-32-characters-long";
});
afterAll(() => {
  process.env.JWT_SECRET = saved.secret;
});
beforeEach(() => {
  useSchedulerEnvironment(T0);
  process.env.APP_URL = APP;
  process.env.RESEND_API_KEY = "re_test";
  sendEmail.mockReset();
});
afterEach(() => {
  resetSchedulerEnvironment();
  process.env.APP_URL = saved.appUrl;
  delete process.env.RESEND_API_KEY;
});

async function setup(channel: "ntfy" | "email") {
  const userId = await seedUser();
  await db
    .update(userSettings)
    .set(
      channel === "ntfy"
        ? { notificationsPush: true, ntfyUrl: "https://ntfy.example.com", ntfyTopic: "capy" }
        : { notificationsEmail: true }
    )
    .where(eq(userSettings.userId, userId));
  const bucketId = await seedBucket(userId, {
    medium: [channel],
    repeat: "once",
    reminderButtons: ["15", "60", "tomorrow"],
  });
  const itemId = await seedItem(userId, bucketId, {
    deadline: new Date(T0.getTime() + 2 * HOUR),
    title: "pay rent",
  });
  await enqueue({ userId, itemId, medium: channel, title: "pay rent", message: "due soon" });
  return { userId, bucketId, itemId };
}

type NtfyBody = {
  topic: string;
  click?: string;
  actions?: { label: string; url: string; body: string; method: string; clear: boolean }[];
};

function ntfyBody(): NtfyBody {
  const fetchMock = vi.mocked(fetch);
  const call = fetchMock.mock.calls.find(([url]) => String(url).startsWith("https://ntfy"));
  return JSON.parse(String(call?.[1]?.body)) as NtfyBody;
}

describe("ntfy", () => {
  it("gets done + the bucket's first two picks, sent straight to heycapy", async () => {
    const { userId, bucketId, itemId } = await setup("ntfy");
    await processPending();

    const body = ntfyBody();
    expect(body.topic).toBe("capy");
    expect(body.click).toBe(`${APP}/?bucket=${bucketId}#item-${itemId}`);
    expect(body.actions?.map((a) => a.label)).toEqual(["✓ done", "⏰ 15 min", "⏰ 1 hour"]);
    const done = body.actions?.[0];
    expect(done).toMatchObject({ url: `${APP}/api/reminder-action`, method: "POST", clear: true });
    const { token } = JSON.parse(done?.body ?? "{}") as { token: string };
    expect(verifyReminderAction(token)).toMatchObject({ userId, itemId, action: "done" });
  });

  it("has no buttons when the server doesn't know its public address", async () => {
    delete process.env.APP_URL;
    await setup("ntfy");
    await processPending();

    const body = ntfyBody();
    expect(body.actions).toBeUndefined();
    expect(body.click).toBeUndefined();
  });
});

describe("email", () => {
  function sentEmail() {
    const [payload] = sendEmail.mock.calls[0] as [{ text: string; html: string }];
    return payload;
  }

  it("links every pick to a confirm page, plus the app", async () => {
    const { bucketId, itemId } = await setup("email");
    await processPending();

    const { text, html } = sentEmail();
    const links = [...text.matchAll(/^(.+): (https:\/\/\S+)$/gm)].map((m) => [m[1], m[2]]);
    expect(links.map(([label]) => label)).toEqual([
      "✓ done",
      "⏰ 15 min",
      "⏰ 1 hour",
      "⏰ tomorrow",
      "open in heycapy",
    ]);
    expect(links[0]?.[1]).toMatch(new RegExp(`^${APP}/r/[\\w-]+\\.[\\w-]+$`));
    expect(links[4]?.[1]).toBe(`${APP}/?bucket=${bucketId}#item-${itemId}`);
    expect(html).toContain(`href="${links[0]?.[1]}"`);
  });

  it("opening a link changes nothing until the button on the page is pressed", async () => {
    const { itemId } = await setup("email");
    await processPending();
    const token = /\/r\/(\S+)$/m.exec(sentEmail().text)?.[1] ?? "";

    const before = await db.query.items.findFirst({ where: eq(items.id, itemId) });
    expect(before?.status).toBe(ITEM_STATUS.active);

    expect(await confirmReminderAction(token)).toMatchObject({ ok: true });
    const after = await db.query.items.findFirst({ where: eq(items.id, itemId) });
    expect(after?.status).toBe(ITEM_STATUS.completed);
  });

  it("the confirm page refuses a tampered link", async () => {
    expect(await confirmReminderAction("tampered.token")).toMatchObject({
      ok: false,
      message: expect.stringContaining("expired"),
    });
  });
});

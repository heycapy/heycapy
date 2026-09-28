import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type * as SessionModule from "@/lib/auth/session";
import type * as WebPushModule from "web-push";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, items, notificationQueue, pushSubscriptions } from "@/lib/db/schema";
import { ITEM_STATUS } from "@/constants";
import { signReminderAction, verifyReminderAction } from "@/lib/reminders/action-token";
import { POST } from "@/app/api/reminder-action/route";
import { bucketReminderButtons } from "@/lib/rules";
import { enqueue, processPending } from "@/lib/notifications/queue";
import { updateBucketSettingsAction } from "@/app/(app)/bucket-actions";
import {
  HOUR,
  resetSchedulerEnvironment,
  seedBucket,
  seedItem,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

const sendNotification = vi.hoisted(() => vi.fn());
vi.mock("web-push", async (importOriginal) => {
  const actual = await importOriginal<typeof WebPushModule & { default: typeof WebPushModule }>();
  return { ...actual, default: { ...actual.default, sendNotification } };
});

const session = vi.hoisted(() => ({ userId: 0, email: "" }));
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof SessionModule>()),
  getSession: async () => session,
}));

const T0 = new Date("2026-03-10T12:00:00Z");
const DEADLINE = new Date(T0.getTime() + 2 * HOUR);

const previousSecret = process.env.JWT_SECRET;
beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-at-least-32-characters-long";
});
afterAll(() => {
  process.env.JWT_SECRET = previousSecret;
});
beforeEach(() => {
  useSchedulerEnvironment(T0);
  sendNotification.mockReset();
  sendNotification.mockResolvedValue({ statusCode: 201, body: "", headers: {} });
});
afterEach(() => resetSchedulerEnvironment());

async function setup(rules?: Record<string, unknown>) {
  const userId = await seedUser();
  const bucketId = await seedBucket(userId, { medium: ["push"], repeat: "once", ...rules });
  const itemId = await seedItem(userId, bucketId, { deadline: DEADLINE, title: "pay rent" });
  return { userId, bucketId, itemId };
}

function tap(token: string) {
  return POST(
    new Request("http://localhost/api/reminder-action", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
  );
}

async function itemById(id: number) {
  const [row] = await db.select().from(items).where(eq(items.id, id));
  return row;
}

describe("signed action links", () => {
  const claim = { userId: 1, itemId: 2, action: "done" as const, deadline: DEADLINE.getTime() };

  it("carry exactly what they were made for", () => {
    expect(verifyReminderAction(signReminderAction(claim))).toEqual(claim);
  });

  it("stop working when edited or expired", () => {
    const token = signReminderAction(claim);
    const [body, sig] = token.split(".");
    const edited = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(body ?? "", "base64url").toString()), i: 3 })
    ).toString("base64url");
    expect(verifyReminderAction(`${edited}.${sig}`)).toBeNull();
    expect(verifyReminderAction("not-a-token")).toBeNull();

    const eightDaysLater = new Date(Date.now() + 8 * 24 * HOUR);
    expect(verifyReminderAction(token, eightDaysLater)).toBeNull();
  });
});

describe("tapping a reminder button", () => {
  it("done completes the item", async () => {
    const { userId, itemId } = await setup();
    const res = await tap(
      signReminderAction({ userId, itemId, action: "done", deadline: DEADLINE.getTime() })
    );

    expect(await res.json()).toMatchObject({ ok: true, message: '✓ "pay rent" done' });
    expect((await itemById(itemId))?.status).toBe(ITEM_STATUS.completed);
  });

  it("remind again pings later without moving the deadline", async () => {
    const { userId, itemId } = await setup();
    const res = await tap(
      signReminderAction({ userId, itemId, action: "60", deadline: DEADLINE.getTime() })
    );

    expect((await res.json()).ok).toBe(true);
    const item = await itemById(itemId);
    expect(item?.deadline).toEqual(DEADLINE);
    expect(item?.remindNotBefore).toEqual(new Date(T0.getTime() + HOUR));
  });

  it("a button from before the item changed does nothing", async () => {
    const { userId, itemId } = await setup();
    const token = signReminderAction({
      userId,
      itemId,
      action: "done",
      deadline: DEADLINE.getTime(),
    });
    await db
      .update(items)
      .set({ deadline: new Date(DEADLINE.getTime() + 24 * HOUR) })
      .where(eq(items.id, itemId));

    expect((await (await tap(token)).json()).message).toContain("outdated");
    expect((await itemById(itemId))?.status).toBe(ITEM_STATUS.active);
  });

  it("says so when the item is already done or gone", async () => {
    const { userId, itemId } = await setup();
    const token = signReminderAction({
      userId,
      itemId,
      action: "done",
      deadline: DEADLINE.getTime(),
    });
    await tap(token);
    expect((await (await tap(token)).json()).message).toContain("already done");

    await db.update(items).set({ deletedAt: T0 }).where(eq(items.id, itemId));
    expect((await (await tap(token)).json()).message).toBe("this item no longer exists");
  });

  it("can't touch another user's item", async () => {
    const { itemId } = await setup();
    const stranger = await seedUser();
    const token = signReminderAction({
      userId: stranger,
      itemId,
      action: "done",
      deadline: DEADLINE.getTime(),
    });

    expect((await (await tap(token)).json()).ok).toBe(false);
    expect((await itemById(itemId))?.status).toBe(ITEM_STATUS.active);
  });

  it("rejects a forged or missing token", async () => {
    const res = await tap("forged.token");
    expect(res.status).toBe(400);
    expect((await res.json()).message).toContain("expired");
  });
});

describe("bucket setting", () => {
  it("defaults to 1 hour + tomorrow and keeps the fixed order", async () => {
    expect(bucketReminderButtons("{}")).toEqual(["60", "tomorrow"]);
    expect(bucketReminderButtons(JSON.stringify({ reminderButtons: ["tomorrow", "15"] }))).toEqual([
      "15",
      "tomorrow",
    ]);
    expect(bucketReminderButtons(JSON.stringify({ reminderButtons: [] }))).toEqual([]);
  });
});

describe("push notifications", () => {
  async function sentPayload(userId: number, itemId: number, kind: "reminder" | "arrival") {
    await db.insert(pushSubscriptions).values({
      userId,
      endpoint: `https://push.example.com/${userId}`,
      p256dh: "BKey",
      auth: "auth",
      deviceName: "Chrome on Android",
    });
    await enqueue({ userId, itemId, medium: "push", title: "pay rent", message: "due soon" });
    await db.update(notificationQueue).set({ kind }).where(eq(notificationQueue.userId, userId));
    await processPending();
    const [, payload] = sendNotification.mock.calls[0] as [unknown, string];
    return JSON.parse(payload) as {
      url?: string;
      actions?: { action: string; title: string; token: string }[];
    };
  }

  it("carry done + the bucket's first pick, and open the item's bucket", async () => {
    const { userId, bucketId, itemId } = await setup({ reminderButtons: ["15", "tomorrow"] });
    const payload = await sentPayload(userId, itemId, "reminder");

    expect(payload.url).toBe(`/?bucket=${bucketId}#item-${itemId}`);
    expect(payload.actions?.map((a) => [a.action, a.title])).toEqual([
      ["done", "✓ done"],
      ["15", "⏰ 15 min"],
    ]);
    expect(verifyReminderAction(payload.actions?.[0]?.token ?? "")).toMatchObject({
      userId,
      itemId,
      action: "done",
    });
  });

  it("show only done when the bucket picked no remind-again times", async () => {
    const { userId, itemId } = await setup({ reminderButtons: [] });
    const payload = await sentPayload(userId, itemId, "reminder");
    expect(payload.actions?.map((a) => a.action)).toEqual(["done"]);
  });

  it("have no buttons for 'new item arrived' alerts", async () => {
    const { userId, itemId } = await setup();
    const payload = await sentPayload(userId, itemId, "arrival");
    expect(payload.actions).toBeUndefined();
  });
});

it("saving bucket settings drops unknown reminder buttons instead of losing the channels", async () => {
  session.userId = await seedUser();
  const bucketId = await seedBucket(session.userId, { medium: ["push"], repeat: "once" });

  await updateBucketSettingsAction(
    bucketId,
    "Bills",
    {},
    { medium: ["push"], reminderButtons: ["60", "2 days" as never] }
  );

  const [bucket] = await db.select().from(buckets).where(eq(buckets.id, bucketId));
  const rules = JSON.parse(bucket?.notificationsRules ?? "{}") as Record<string, unknown>;
  expect(rules.reminderButtons).toEqual(["60"]);
  expect(rules.medium).toEqual(["push"]);
});

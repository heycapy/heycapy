import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as SessionModule from "@/lib/auth/session";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  bucketMembers,
  itemReminders,
  items,
  notificationQueue,
  outgoingWebhooks,
} from "@/lib/db/schema";
import { addItemAction, updateItemAction } from "@/app/(app)/item-actions";
import {
  createInviteAction,
  joinBucketAction,
  leaveBucketAction,
} from "@/app/(app)/member-actions";
import { newWebhookSecret } from "@/lib/notifications/webhook";
import { NOT_RECIPIENT_ERROR } from "@/lib/notifications/constants";
import type { ReminderAction } from "@/lib/reminders/action-token";
import {
  applyReminderAction,
  cancelRemindAgain,
  remindItemAgain,
} from "@/lib/reminders/quick-actions";
import {
  getItemReminderInfo,
  getReminderBadges,
  withViewerReminders,
} from "@/lib/reminders/status";
import {
  reminderOf,
  resetSchedulerEnvironment,
  runSchedulerAt,
  seedBucket,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

const session = vi.hoisted(() => ({ userId: 0, email: "" }));
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof SessionModule>()),
  getSession: async () => session,
}));

const INDIA = "Asia/Kolkata";
const LONDON = "Europe/London";
const NOW = new Date("2026-10-20T12:00:00Z");
// The UK moves its clocks back on 25 Oct 2026: 09:00 London is 08:00Z before, 09:00Z after
const OCT_24 = {
  india: new Date("2026-10-24T03:30:00Z"),
  london: new Date("2026-10-24T08:00:00Z"),
};
const OCT_26 = {
  india: new Date("2026-10-26T03:30:00Z"),
  london: new Date("2026-10-26T09:00:00Z"),
};
const MINUTE = 60_000;
const justAfter = (at: Date) => new Date(at.getTime() + MINUTE);

beforeEach(() => {
  useSchedulerEnvironment(NOW);
  process.env.E2E_TEST_MODE = "1";
});
afterEach(() => {
  delete process.env.E2E_TEST_MODE;
  resetSchedulerEnvironment();
});

async function sharedBucket(webhooks: number[] = []) {
  const owner = await seedUser(INDIA);
  const member = await seedUser(LONDON);
  const bucketId = await seedBucket(owner, { medium: ["telegram"], webhooks, repeat: "once" });
  await db.insert(bucketMembers).values({ bucketId, userId: member });
  return { owner, member, bucketId };
}

async function add(bucketId: number, date: string, assigneeId?: number): Promise<number> {
  const result = await addItemAction(
    bucketId,
    "pay rent",
    date,
    undefined,
    undefined,
    undefined,
    undefined,
    assigneeId
  );
  if (!result.ok) throw new Error(result.error);
  const [row] = await db
    .select({ id: items.id })
    .from(items)
    .where(eq(items.bucketId, bucketId))
    .orderBy(desc(items.id))
    .limit(1);
  return row.id;
}

async function sentTo(itemId: number) {
  const jobs = await db
    .select({ userId: notificationQueue.userId, medium: notificationQueue.medium })
    .from(notificationQueue)
    .where(and(eq(notificationQueue.itemId, itemId), eq(notificationQueue.status, "sent")));
  return jobs;
}

const recipients = async (itemId: number) =>
  (await db.select().from(itemReminders).where(eq(itemReminders.itemId, itemId)))
    .map((r) => r.userId)
    .sort((a, b) => a - b);

describe("an item nobody is assigned to", () => {
  it("reminds every member at 09:00 on their own clock, across the UK clock change", async () => {
    const { owner, member, bucketId } = await sharedBucket();
    session.userId = owner;
    const before = await add(bucketId, "2026-10-24");
    const after = await add(bucketId, "2026-10-26");

    expect((await reminderOf(before, owner)).nextReminderAt).toEqual(OCT_24.india);
    expect((await reminderOf(before, member)).nextReminderAt).toEqual(OCT_24.london);
    expect((await reminderOf(after, owner)).nextReminderAt).toEqual(OCT_26.india);
    expect((await reminderOf(after, member)).nextReminderAt).toEqual(OCT_26.london);

    await runSchedulerAt(justAfter(OCT_26.india));
    expect(await sentTo(after)).toEqual([{ userId: owner, medium: "telegram" }]);
    await runSchedulerAt(justAfter(OCT_26.london));
    expect(await sentTo(after)).toEqual([
      { userId: owner, medium: "telegram" },
      { userId: member, medium: "telegram" },
    ]);
  });

  it("is reminded again to everyone once its date moves", async () => {
    const { owner, member, bucketId } = await sharedBucket();
    session.userId = owner;
    const itemId = await add(bucketId, "2026-10-26");
    await runSchedulerAt(justAfter(OCT_26.london));
    expect((await reminderOf(itemId, member)).nextReminderAt).toBeNull();

    await updateItemAction(itemId, "pay rent", "2026-10-28");

    expect((await reminderOf(itemId, owner)).nextReminderAt).toEqual(
      new Date("2026-10-28T03:30:00Z")
    );
    expect((await reminderOf(itemId, member)).nextReminderAt).toEqual(
      new Date("2026-10-28T09:00:00Z")
    );
  });
});

describe("remind me later", () => {
  it("reminds everyone again, even those already reminded", async () => {
    const { owner, member, bucketId } = await sharedBucket();
    session.userId = owner;
    const itemId = await add(bucketId, "2026-10-26");
    await runSchedulerAt(justAfter(OCT_26.india));
    await runSchedulerAt(justAfter(OCT_26.london));

    const later = await remindItemAgain(
      owner,
      itemId,
      "30",
      INDIA,
      "app",
      justAfter(OCT_26.london)
    );

    const at = new Date(justAfter(OCT_26.london).getTime() + 30 * MINUTE);
    expect(later).toEqual(at);
    expect((await reminderOf(itemId, member)).nextReminderAt).toEqual(at);
  });
});

describe("an assigned item", () => {
  it("reminds only the person it's assigned to", async () => {
    const { owner, member, bucketId } = await sharedBucket();
    session.userId = owner;
    const itemId = await add(bucketId, "2026-10-26", member);

    expect(await recipients(itemId)).toEqual([member]);
    await runSchedulerAt(justAfter(OCT_26.london));
    expect(await sentTo(itemId)).toEqual([{ userId: member, medium: "telegram" }]);
  });

  it("moves to whoever it's given to, who isn't sent what already went out", async () => {
    const { owner, member, bucketId } = await sharedBucket();
    session.userId = owner;
    const itemId = await add(bucketId, "2026-10-26", member);
    await runSchedulerAt(justAfter(OCT_26.london));

    await updateItemAction(
      itemId,
      "pay rent",
      "2026-10-26",
      undefined,
      undefined,
      undefined,
      undefined,
      owner
    );

    expect(await recipients(itemId)).toEqual([owner]);
    expect((await reminderOf(itemId, owner)).notifiedAt).toEqual(justAfter(OCT_26.london));
    await runSchedulerAt(new Date(OCT_26.london.getTime() + 10 * MINUTE));
    expect(await sentTo(itemId)).toEqual([{ userId: member, medium: "telegram" }]);
  });

  it("goes back to everyone when its person leaves, without a late reminder", async () => {
    const { owner, member, bucketId } = await sharedBucket();
    session.userId = owner;
    const itemId = await add(bucketId, "2026-10-26", member);
    await runSchedulerAt(justAfter(OCT_26.london));

    session.userId = member;
    expect(await leaveBucketAction(bucketId)).toEqual({ ok: true });

    expect(await recipients(itemId)).toEqual([owner]);
    expect((await reminderOf(itemId, owner)).nextReminderAt).toBeNull();
  });
});

describe("someone who joins", () => {
  it("is reminded on their own clock, but not about anything whose time has passed", async () => {
    const owner = await seedUser(INDIA);
    const bucketId = await seedBucket(owner, { medium: ["telegram"], repeat: "once" });
    session.userId = owner;
    const passed = await add(bucketId, "2026-10-22");
    const upcoming = await add(bucketId, "2026-10-26");
    await runSchedulerAt(new Date("2026-10-22T03:31:00Z"));

    vi.setSystemTime(new Date("2026-10-23T12:00:00Z"));
    const friend = await seedUser(LONDON);
    const invite = await createInviteAction(bucketId);
    if (!invite.ok) throw new Error(invite.error);
    session.userId = friend;
    expect(await joinBucketAction(invite.code)).toMatchObject({ ok: true });

    expect((await reminderOf(passed, friend)).nextReminderAt).toBeNull();
    expect((await reminderOf(upcoming, friend)).nextReminderAt).toEqual(OCT_26.london);
    await runSchedulerAt(new Date("2026-10-23T12:01:00Z"));
    expect(await sentTo(passed)).toEqual([{ userId: owner, medium: "telegram" }]);
  });

  it("still gets a reminder whose time on their clock is ahead", async () => {
    const owner = await seedUser(INDIA);
    const bucketId = await seedBucket(owner, { medium: ["telegram"], repeat: "once" });
    session.userId = owner;
    const itemId = await add(bucketId, "2026-10-24");
    await runSchedulerAt(justAfter(OCT_24.india));

    const friend = await seedUser(LONDON);
    const invite = await createInviteAction(bucketId);
    if (!invite.ok) throw new Error(invite.error);
    session.userId = friend;
    await joinBucketAction(invite.code);

    expect((await reminderOf(itemId, friend)).nextReminderAt).toEqual(OCT_24.london);
  });
});

describe("the bucket's webhook", () => {
  async function withWebhook() {
    const owner = await seedUser(INDIA);
    const [webhook] = await db
      .insert(outgoingWebhooks)
      .values({
        userId: owner,
        name: "family discord",
        url: "https://discord.com/api/webhooks/1/x",
        secret: newWebhookSecret(),
      })
      .returning();
    const member = await seedUser(LONDON);
    const bucketId = await seedBucket(owner, {
      medium: ["telegram"],
      webhooks: [webhook.id],
      repeat: "once",
    });
    await db.insert(bucketMembers).values({ bucketId, userId: member });
    return { owner, member, bucketId };
  }

  const webhookJobs = async (itemId: number) =>
    (await sentTo(itemId)).filter((j) => j.medium === "webhook");

  it("goes out once, with the owner's reminder", async () => {
    const { owner, bucketId } = await withWebhook();
    session.userId = owner;
    const itemId = await add(bucketId, "2026-10-26");

    await runSchedulerAt(justAfter(OCT_26.india));
    await runSchedulerAt(justAfter(OCT_26.london));

    expect(await webhookJobs(itemId)).toEqual([{ userId: owner, medium: "webhook" }]);
  });

  it("goes out with the assignee's reminder when the owner isn't reminded", async () => {
    const { owner, member, bucketId } = await withWebhook();
    session.userId = owner;
    const itemId = await add(bucketId, "2026-10-26", member);

    await runSchedulerAt(justAfter(OCT_26.india));
    expect(await webhookJobs(itemId)).toEqual([]);
    await runSchedulerAt(justAfter(OCT_26.london));
    expect(await webhookJobs(itemId)).toEqual([{ userId: owner, medium: "webhook" }]);
    expect((await sentTo(itemId)).filter((j) => j.userId === member)).toEqual([
      { userId: member, medium: "telegram" },
    ]);
  });
});

describe("the reminder icon", () => {
  it("shows each person their own next reminder", async () => {
    const { owner, member, bucketId } = await sharedBucket();
    session.userId = owner;
    const itemId = await add(bucketId, "2026-10-26", member);
    const rows = await db.select().from(items).where(eq(items.id, itemId));
    const rules = JSON.stringify({ medium: ["telegram"], webhooks: [], repeat: "once" });

    const forMember = await withViewerReminders(member, rows);
    expect(forMember[0].nextReminderAt).toEqual(OCT_26.london);
    expect(await getReminderBadges(member, rules, forMember)).toEqual({ [itemId]: "upcoming" });

    const forOwner = await withViewerReminders(owner, rows);
    expect(forOwner[0].nextReminderAt).toBeNull();
    expect(await getReminderBadges(owner, rules, forOwner)).toEqual({ [itemId]: "history" });
  });
});

describe("a member pressing a reminder's button", () => {
  async function press(userId: number, itemId: number, action: ReminderAction, now: Date) {
    const item = await db.query.items.findFirst({ where: eq(items.id, itemId) });
    const deadline = item?.deadline?.getTime() ?? null;
    return applyReminderAction({ userId, itemId, action, channel: "push", deadline }, now);
  }

  it("marks the item done for everyone", async () => {
    const { owner, member, bucketId } = await sharedBucket();
    session.userId = owner;
    const itemId = await add(bucketId, "2026-10-26");
    await runSchedulerAt(justAfter(OCT_26.india));

    const done = await press(member, itemId, "done", justAfter(OCT_26.india));

    expect(done).toMatchObject({ ok: true, message: '✓ "pay rent" done' });
    expect((await db.query.items.findFirst({ where: eq(items.id, itemId) }))?.status).toBe(
      "completed"
    );
    await runSchedulerAt(justAfter(OCT_26.london));
    expect(await sentTo(itemId)).toEqual([{ userId: owner, medium: "telegram" }]);
  });

  it("reminds everyone later, and can cancel it from the app", async () => {
    const { owner, member, bucketId } = await sharedBucket();
    session.userId = owner;
    const itemId = await add(bucketId, "2026-10-26");
    const pressedAt = justAfter(OCT_26.london);
    await runSchedulerAt(pressedAt);

    const later = await press(member, itemId, "60", pressedAt);

    const at = new Date(pressedAt.getTime() + 60 * MINUTE);
    expect(later).toMatchObject({ ok: true });
    expect((await reminderOf(itemId, owner)).nextReminderAt).toEqual(at);
    expect((await reminderOf(itemId, member)).nextReminderAt).toEqual(at);
    expect(await cancelRemindAgain(member, itemId, "app", pressedAt)).toBe(true);
    expect((await reminderOf(itemId, owner)).nextReminderAt).toBeNull();
  });

  it("puts off until tomorrow on the presser's own clock", async () => {
    const { owner, member, bucketId } = await sharedBucket();
    session.userId = owner;
    const itemId = await add(bucketId, "2026-10-24");
    await runSchedulerAt(justAfter(OCT_24.london));

    await press(member, itemId, "tomorrow", justAfter(OCT_24.london));

    // 09:01 London on the 25th, after the clocks went back: 25 hours later
    const tomorrow = new Date("2026-10-25T09:01:00Z");
    expect((await reminderOf(itemId, member)).nextReminderAt).toEqual(tomorrow);
  });

  it("does nothing for someone who isn't in the bucket", async () => {
    const { owner, bucketId } = await sharedBucket();
    const stranger = await seedUser(LONDON);
    session.userId = owner;
    const itemId = await add(bucketId, "2026-10-26");

    expect(await press(stranger, itemId, "done", NOW)).toEqual({
      ok: false,
      message: "this item no longer exists",
    });
    expect(await cancelRemindAgain(stranger, itemId, "app", NOW)).toBe(false);
  });
});

describe("a reminder still queued for someone the item was taken from", () => {
  it("isn't sent, and their item info says why", async () => {
    const { owner, member, bucketId } = await sharedBucket();
    session.userId = owner;
    const itemId = await add(bucketId, "2026-10-26", member);
    const [retry] = await db
      .insert(notificationQueue)
      .values({
        userId: member,
        itemId,
        medium: "telegram",
        kind: "reminder",
        title: "[heycapy] reminder",
        message: "pay rent",
        attempts: 1,
        nextRetryAt: OCT_26.london,
      })
      .returning();

    await updateItemAction(
      itemId,
      "pay rent",
      "2026-10-26",
      undefined,
      undefined,
      undefined,
      undefined,
      owner
    );
    await runSchedulerAt(justAfter(OCT_26.london));

    const job = await db.query.notificationQueue.findFirst({
      where: eq(notificationQueue.id, retry.id),
    });
    expect(job).toMatchObject({ status: "cancelled", lastError: NOT_RECIPIENT_ERROR });
    const info = await getItemReminderInfo(member, itemId);
    expect(info?.reason).toBe("notRecipient");
    expect(info?.history).toMatchObject([{ type: "sent", channels: [{ outcome: "handedOver" }] }]);
  });
});

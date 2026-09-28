import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { signReminderAction } from "@/lib/reminders/action-token";
import {
  applyReminderAction,
  cancelRemindAgain,
  completeItem,
} from "@/lib/reminders/quick-actions";
import { getItemReminderInfo, type HistoryEvent } from "@/lib/reminders/status";
import { verifyReminderAction } from "@/lib/reminders/action-token";
import {
  MINUTE,
  remindersQueued,
  resetSchedulerEnvironment,
  runSchedulerAt,
  seedBucket,
  seedItem,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

const T0 = new Date("2026-03-10T12:00:00Z");

const previousSecret = process.env.JWT_SECRET;
beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-at-least-32-characters-long";
});
afterAll(() => {
  process.env.JWT_SECRET = previousSecret;
});
beforeEach(() => useSchedulerEnvironment(T0));
afterEach(() => resetSchedulerEnvironment());

async function remindedItem() {
  const userId = await seedUser();
  const bucketId = await seedBucket(userId);
  const itemId = await seedItem(userId, bucketId, { deadline: T0, notifiedAt: T0 });
  return { userId, itemId };
}

async function tap(
  userId: number,
  itemId: number,
  action: "done" | "15",
  channel: "email" | "ntfy"
) {
  const token = signReminderAction({ userId, itemId, action, channel, deadline: T0.getTime() });
  const claim = verifyReminderAction(token);
  if (!claim) throw new Error("token did not verify");
  return applyReminderAction(claim, T0);
}

const actionsIn = (history: HistoryEvent[] | undefined) =>
  (history ?? []).filter((e) => e.type === "action");

it("remind again shows as pending, with where it was asked from, and in the history", async () => {
  const { userId, itemId } = await remindedItem();
  await tap(userId, itemId, "15", "email");

  const info = await getItemReminderInfo(userId, itemId);
  expect(info?.remindAgain).toEqual({ at: new Date(T0.getTime() + 15 * MINUTE), source: "email" });
  expect(actionsIn(info?.history)).toEqual([
    {
      type: "action",
      at: T0,
      action: "remindAgain",
      source: "email",
      remindAt: new Date(T0.getTime() + 15 * MINUTE),
    },
  ]);
});

it("done is recorded with the channel it came from", async () => {
  const { userId, itemId } = await remindedItem();
  await tap(userId, itemId, "done", "ntfy");
  const { itemId: other, userId: otherUser } = await remindedItem();
  await completeItem(otherUser, other, "telegram", T0);

  expect(actionsIn((await getItemReminderInfo(userId, itemId))?.history)).toMatchObject([
    { action: "done", source: "ntfy" },
  ]);
  expect(actionsIn((await getItemReminderInfo(otherUser, other))?.history)).toMatchObject([
    { action: "done", source: "telegram" },
  ]);
});

it("cancelling stops the extra ping instead of sending it straight away", async () => {
  const { userId, itemId } = await remindedItem();
  await tap(userId, itemId, "15", "email");
  const queuedBefore = await remindersQueued(itemId);

  expect(await cancelRemindAgain(userId, itemId, "app", T0)).toBe(true);
  await runSchedulerAt(new Date(T0.getTime() + MINUTE));
  await runSchedulerAt(new Date(T0.getTime() + 16 * MINUTE));

  expect(await remindersQueued(itemId)).toBe(queuedBefore);
  const info = await getItemReminderInfo(userId, itemId);
  expect(info?.remindAgain).toBeNull();
  expect(actionsIn(info?.history).map((e) => e.type === "action" && e.action)).toEqual([
    "cancelRemindAgain",
    "remindAgain",
  ]);
});

it("cancelling keeps the item's own reminder that hasn't gone out yet", async () => {
  const userId = await seedUser();
  const bucketId = await seedBucket(userId);
  const deadline = new Date(T0.getTime() + 60 * MINUTE);
  const itemId = await seedItem(userId, bucketId, { deadline });
  const token = signReminderAction({
    userId,
    itemId,
    action: "15",
    channel: "email",
    deadline: deadline.getTime(),
  });
  const claim = verifyReminderAction(token);
  if (claim) await applyReminderAction(claim, T0);

  expect(await cancelRemindAgain(userId, itemId, "app", T0)).toBe(true);
  expect((await getItemReminderInfo(userId, itemId))?.next).toEqual(deadline);
});

it("there is nothing to cancel when no remind again is pending", async () => {
  const { userId, itemId } = await remindedItem();
  expect(await cancelRemindAgain(userId, itemId, "app", T0)).toBe(false);
  const stranger = await seedUser();
  await tap(userId, itemId, "15", "email");
  expect(await cancelRemindAgain(stranger, itemId, "app", T0)).toBe(false);
  const item = await db.query.items.findFirst({ where: eq(items.id, itemId) });
  expect(item?.remindNotBefore).toEqual(new Date(T0.getTime() + 15 * MINUTE));
});

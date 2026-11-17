import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type * as SessionModule from "@/lib/auth/session";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { patchItemAction } from "@/app/(app)/item-actions";
import { assigneeIdsByItem } from "@/lib/items/assignees";
import {
  reminderOf,
  resetSchedulerEnvironment,
  seedBucket,
  seedItem,
  seedMember,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

const session = vi.hoisted(() => ({ userId: 0, email: "" }));
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof SessionModule>()),
  getSession: async () => session,
}));

beforeEach(() => useSchedulerEnvironment(new Date("2026-03-10T12:00:00Z")));
afterEach(() => resetSchedulerEnvironment());

const DEADLINE = new Date("2026-03-15T09:00:00Z");

async function setUp() {
  session.userId = await seedUser();
  const bucketId = await seedBucket(session.userId);
  const itemId = await seedItem(session.userId, bucketId, {
    deadline: DEADLINE,
    title: "rent",
    reminderOffsets: [60],
  });
  await db
    .update(items)
    .set({
      deadlineTimezone: "Asia/Kolkata",
      recurring: JSON.stringify({
        enabled: true,
        frequency: "monthly",
        interval: 1,
        endDate: null,
        anchorDay: 15,
      }),
      properties: JSON.stringify({ amount: 40 }),
    })
    .where(eq(items.id, itemId));
  return { bucketId, itemId };
}

async function saved(itemId: number) {
  const item = await db.query.items.findFirst({ where: eq(items.id, itemId) });
  if (!item) throw new Error("item missing");
  return item;
}

it("a title alone leaves the date, clock, repeat, reminders and fields as they were", async () => {
  const { itemId } = await setUp();
  const before = await saved(itemId);
  const reminderBefore = await reminderOf(itemId);

  expect(await patchItemAction(itemId, { title: "pay rent" })).toEqual({ ok: true });

  const after = await saved(itemId);
  expect(after.title).toBe("pay rent");
  expect(after.deadline).toEqual(before.deadline);
  expect(after.deadlineTimezone).toBe("Asia/Kolkata");
  expect(after.recurring).toBe(before.recurring);
  expect(after.properties).toBe(before.properties);
  expect(after.reminderOffsets).toEqual([60]);
  expect((await reminderOf(itemId)).nextReminderAt).toEqual(reminderBefore.nextReminderAt);
});

it("a date alone leaves the title as it was and moves the reminder with it", async () => {
  const { itemId } = await setUp();
  const reminderBefore = await reminderOf(itemId);

  expect(await patchItemAction(itemId, { deadline: "2026-03-20T09:00:00.000Z" })).toEqual({
    ok: true,
  });

  const after = await saved(itemId);
  expect(after.title).toBe("rent");
  expect(after.deadline?.toISOString()).toBe("2026-03-20T09:00:00.000Z");
  expect((await reminderOf(itemId)).nextReminderAt).not.toEqual(reminderBefore.nextReminderAt);
});

it("a null date clears the date and the clock it was set on", async () => {
  const { itemId } = await setUp();

  await patchItemAction(itemId, { deadline: null, recurring: null });

  const after = await saved(itemId);
  expect(after.deadline).toBeNull();
  expect(after.deadlineTimezone).toBeNull();
  expect(after.recurring).toBeNull();
  expect(after.title).toBe("rent");
});

it("an empty title is refused and nothing else in the patch is saved", async () => {
  const { itemId } = await setUp();

  const result = await patchItemAction(itemId, { title: "  ", deadline: null });

  expect(result).toEqual({ ok: false, error: "Title is required" });
  expect((await saved(itemId)).deadline).toEqual(DEADLINE);
});

it("assignees alone change who the item is for and nothing else", async () => {
  const { bucketId, itemId } = await setUp();
  const other = await seedUser();
  await seedMember(bucketId, other);

  expect(await patchItemAction(itemId, { assigneeIds: [other] })).toEqual({ ok: true });

  expect((await assigneeIdsByItem([itemId])).get(itemId)).toEqual([other]);
  const after = await saved(itemId);
  expect(after.title).toBe("rent");
  expect(after.deadline).toEqual(DEADLINE);
});

it("refuses an assignee who is not in the bucket", async () => {
  const { itemId } = await setUp();
  const stranger = await seedUser();

  const result = await patchItemAction(itemId, { assigneeIds: [stranger] });

  expect(result.ok).toBe(false);
});

it("a status alone ticks the item without touching its date", async () => {
  const { itemId } = await setUp();

  await patchItemAction(itemId, { status: "completed" });

  const after = await saved(itemId);
  expect(after.status).toBe("completed");
  expect(after.completedBy).toBe(session.userId);
  expect(after.title).toBe("rent");
});

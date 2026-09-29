import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type * as SessionModule from "@/lib/auth/session";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { updateItemAction } from "@/app/(app)/item-actions";
import type { RecurringConfig } from "@/types/rules";
import {
  resetSchedulerEnvironment,
  seedBucket,
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

const monthly: RecurringConfig = {
  enabled: true,
  frequency: "monthly",
  interval: 1,
  endDate: null,
};

async function monthlyItemOn15th() {
  session.userId = await seedUser();
  const bucketId = await seedBucket(session.userId);
  const [item] = await db
    .insert(items)
    .values({
      userId: session.userId,
      bucketId,
      title: "rent",
      deadline: new Date("2026-03-15T09:00:00Z"),
      recurring: JSON.stringify({ ...monthly, anchorDay: 15 }),
    })
    .returning();
  return item.id;
}

async function save(itemId: number, recurring: RecurringConfig) {
  return updateItemAction(itemId, "rent", "2026-03-15T09:00:00.000Z", undefined, recurring);
}

async function savedRepeat(itemId: number) {
  const item = await db.query.items.findFirst({ where: eq(items.id, itemId) });
  return JSON.parse(item?.recurring ?? "{}") as RecurringConfig;
}

it("switching a monthly repeat to the last day sticks, and back to its own day", async () => {
  const itemId = await monthlyItemOn15th();

  expect(await save(itemId, { ...monthly, anchorDay: 31 })).toEqual({ ok: true });
  expect((await savedRepeat(itemId)).anchorDay).toBe(31);

  expect(await save(itemId, { ...monthly, anchorDay: 15 })).toEqual({ ok: true });
  expect((await savedRepeat(itemId)).anchorDay).toBe(15);
});

it("keeps the pinned day when an edit doesn't send one", async () => {
  const itemId = await monthlyItemOn15th();
  await save(itemId, monthly);
  expect((await savedRepeat(itemId)).anchorDay).toBe(15);
});

it("rejects repeat settings that don't make sense instead of saving them", async () => {
  const itemId = await monthlyItemOn15th();
  const result = await save(itemId, { ...monthly, frequency: "weekly", weekdays: [9] });
  expect(result).toEqual({ ok: false, error: "Invalid repeat settings" });
  expect((await savedRepeat(itemId)).frequency).toBe("monthly");
});

it("a last-day repeat moves the date to the month's last day, keeping the time", async () => {
  const itemId = await monthlyItemOn15th();
  const deadline = async () =>
    (await db.query.items.findFirst({ where: eq(items.id, itemId) }))?.deadline?.toISOString();

  await save(itemId, { ...monthly, anchorDay: 31 });
  expect(await deadline()).toBe("2026-03-31T09:00:00.000Z");

  await updateItemAction(itemId, "rent", "2026-03-15T09:00:00.000Z", "active");
  expect(await deadline()).toBe("2026-03-31T09:00:00.000Z");
});

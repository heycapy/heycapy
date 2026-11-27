import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { itemReminders, items, syncState } from "@/lib/db/schema";
import { ITEM_GONE_ERROR } from "@/constants";
import { moveItem } from "@/lib/items/move";
import { skipOccurrence } from "@/lib/items/recurrence";
import {
  HOUR,
  resetSchedulerEnvironment,
  seedBucket,
  seedItem,
  seedMember,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

const T0 = new Date("2026-03-10T12:00:00Z");
const WEEKLY = JSON.stringify({ enabled: true, frequency: "weekly", interval: 1, endDate: null });

beforeEach(() => useSchedulerEnvironment(T0));
afterEach(() => resetSchedulerEnvironment());

const itemOf = (id: string) => db.select().from(items).where(eq(items.id, id)).get();
const remindersOf = (id: string) =>
  db.select().from(itemReminders).where(eq(itemReminders.itemId, id)).all();
const counter = () => db.select().from(syncState).get()?.rev ?? 0;
const state = (id: string) => ({
  item: itemOf(id),
  reminders: remindersOf(id),
  counter: counter(),
});

async function setup(recurring?: string) {
  const owner = await seedUser();
  const bucketId = await seedBucket(owner);
  const id = await seedItem(owner, bucketId, { deadline: new Date(T0.getTime() + HOUR) });
  if (recurring) db.update(items).set({ recurring }).where(eq(items.id, id)).run();
  return { owner, bucketId, id };
}

describe("moveItem", () => {
  it("moves the date and the reminders follow it", async () => {
    const { owner, id } = await setup();

    expect(moveItem(db, owner, id, "2026-03-15", T0)).toEqual({ ok: true });

    expect(itemOf(id)?.deadline?.getTime()).toBeGreaterThan(T0.getTime() + 3 * 24 * HOUR);
    const next = remindersOf(id).map((r) => r.nextReminderAt ?? r.nextOverdueAt);
    expect(next.every((at) => at === null || at.getTime() > T0.getTime() + 3 * 24 * HOUR)).toBe(
      true
    );
  });

  it("moves one occurrence of a repeating item and keeps the series", async () => {
    const { owner, id } = await setup(WEEKLY);
    const original = itemOf(id)?.deadline;

    expect(moveItem(db, owner, id, "2026-03-12", T0)).toEqual({ ok: true });

    expect(itemOf(id)?.deadline?.getTime()).not.toBe(original?.getTime());
    expect(itemOf(id)?.scheduledAt).not.toBeNull();
  });

  it("lets a member of a shared bucket move it", async () => {
    const { bucketId, id } = await setup();
    const friend = await seedUser();
    await seedMember(bucketId, friend);

    expect(moveItem(db, friend, id, "2026-03-15", T0)).toEqual({ ok: true });
  });

  it("refuses a stranger and a trashed item, and an invalid date, and changes nothing", async () => {
    const { owner, id } = await setup();
    const stranger = await seedUser();
    const before = state(id);

    expect(moveItem(db, stranger, id, "2026-03-15", T0)).toEqual({
      ok: false,
      error: ITEM_GONE_ERROR,
    });
    expect(moveItem(db, owner, id, "not a date", T0)).toEqual({ ok: false, error: "Invalid date" });
    expect(state(id)).toEqual(before);

    db.update(items).set({ deletedAt: T0, deletedBy: owner }).where(eq(items.id, id)).run();
    const trashed = state(id);
    expect(moveItem(db, owner, id, "2026-03-15", T0)).toEqual({
      ok: false,
      error: ITEM_GONE_ERROR,
    });
    expect(state(id)).toEqual(trashed);
  });

  it("is undone with the surrounding transaction", async () => {
    const { owner, id } = await setup();
    const before = state(id);

    expect(() =>
      db.transaction((tx) => {
        expect(moveItem(tx, owner, id, "2026-03-15", T0)).toEqual({ ok: true });
        throw new Error("halfway");
      })
    ).toThrow("halfway");

    expect(state(id)).toEqual(before);
  });

  it("undoes the new date when refreshing the reminders fails", async () => {
    const { owner, id } = await setup();
    const before = state(id);
    db.run(
      `CREATE TRIGGER fail_move_refresh BEFORE UPDATE OF next_reminder_at, next_overdue_at ON item_reminders BEGIN SELECT RAISE(ABORT, 'refresh failed'); END`
    );
    try {
      expect(() => moveItem(db, owner, id, "2026-03-15", T0)).toThrow();
    } finally {
      db.run(`DROP TRIGGER fail_move_refresh`);
    }
    expect(state(id)).toEqual(before);
  });
});

describe("skipOccurrence", () => {
  it("undoes the new date when refreshing the reminders fails", async () => {
    const { owner, id } = await setup(WEEKLY);
    const before = state(id);
    db.run(
      `CREATE TRIGGER fail_skip_refresh BEFORE UPDATE OF next_reminder_at, next_overdue_at ON item_reminders BEGIN SELECT RAISE(ABORT, 'refresh failed'); END`
    );
    try {
      expect(() => skipOccurrence(db, owner, id, T0)).toThrow();
    } finally {
      db.run(`DROP TRIGGER fail_skip_refresh`);
    }
    expect(state(id)).toEqual(before);
  });
});

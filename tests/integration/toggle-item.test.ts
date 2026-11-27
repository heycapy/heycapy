import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { itemReminders, items, syncState } from "@/lib/db/schema";
import { ITEM_STATUS } from "@/constants";
import { toggleItemCompleted } from "@/lib/items/complete";
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
const MONTHLY = JSON.stringify({ enabled: true, frequency: "monthly", interval: 1 });

beforeEach(() => useSchedulerEnvironment(T0));
afterEach(() => resetSchedulerEnvironment());

const itemOf = (id: string) => db.select().from(items).where(eq(items.id, id)).get();
const itemsIn = (bucketId: number) =>
  db.select().from(items).where(eq(items.bucketId, bucketId)).orderBy(items.id).all();
const remindersOf = (id: string) =>
  db.select().from(itemReminders).where(eq(itemReminders.itemId, id)).all();
const counter = () => db.select().from(syncState).get()?.rev ?? 0;

async function setup(recurring?: string) {
  const owner = await seedUser();
  const bucketId = await seedBucket(owner);
  const id = await seedItem(owner, bucketId, { deadline: new Date(T0.getTime() + HOUR) });
  if (recurring) db.update(items).set({ recurring }).where(eq(items.id, id)).run();
  return { owner, bucketId, id };
}

describe("toggleItemCompleted", () => {
  it("completes an item for the person who ticked it and stops its reminders", async () => {
    const { owner, id } = await setup();

    expect(toggleItemCompleted(db, owner, id, T0)).toBe(ITEM_STATUS.completed);

    expect(itemOf(id)).toMatchObject({ status: ITEM_STATUS.completed, completedBy: owner });
    expect(remindersOf(id).every((r) => !r.nextReminderAt && !r.nextOverdueAt)).toBe(true);
  });

  it("reopens a completed item and brings its reminders back", async () => {
    const { owner, id } = await setup();
    toggleItemCompleted(db, owner, id, T0);

    expect(toggleItemCompleted(db, owner, id, T0)).toBe(ITEM_STATUS.active);

    expect(itemOf(id)).toMatchObject({ status: ITEM_STATUS.active, completedAt: null });
    expect(remindersOf(id).some((r) => r.nextReminderAt || r.nextOverdueAt)).toBe(true);
  });

  it("creates the next occurrence of a repeating item when it completes, and not when it reopens", async () => {
    const { owner, bucketId, id } = await setup(MONTHLY);

    toggleItemCompleted(db, owner, id, T0);
    expect(itemsIn(bucketId)).toHaveLength(2);

    toggleItemCompleted(db, owner, id, T0);
    expect(itemsIn(bucketId)).toHaveLength(2);
  });

  it("lets a member of a shared bucket tick", async () => {
    const { bucketId, id } = await setup();
    const friend = await seedUser();
    await seedMember(bucketId, friend);

    expect(toggleItemCompleted(db, friend, id, T0)).toBe(ITEM_STATUS.completed);
    expect(itemOf(id)?.completedBy).toBe(friend);
  });

  it("refuses someone outside the bucket and an item in the trash, and changes nothing", async () => {
    const { owner, bucketId, id } = await setup();
    const stranger = await seedUser();
    const before = itemsIn(bucketId);

    expect(toggleItemCompleted(db, stranger, id, T0)).toBeNull();
    expect(itemsIn(bucketId)).toEqual(before);
    db.update(items).set({ deletedAt: T0, deletedBy: owner }).where(eq(items.id, id)).run();
    const trashed = { items: itemsIn(bucketId), counter: counter() };
    expect(toggleItemCompleted(db, owner, id, T0)).toBeNull();

    expect({ items: itemsIn(bucketId), counter: counter() }).toEqual(trashed);
  });

  it("is undone with the surrounding transaction", async () => {
    const { owner, bucketId, id } = await setup(MONTHLY);
    const before = { items: itemsIn(bucketId), reminders: remindersOf(id), counter: counter() };

    expect(() =>
      db.transaction((tx) => {
        expect(toggleItemCompleted(tx, owner, id, T0)).toBe(ITEM_STATUS.completed);
        throw new Error("halfway");
      })
    ).toThrow("halfway");

    expect({ items: itemsIn(bucketId), reminders: remindersOf(id), counter: counter() }).toEqual(
      before
    );
  });

  it("undoes the tick when creating the next occurrence fails", async () => {
    const { owner, bucketId, id } = await setup(MONTHLY);
    const before = itemsIn(bucketId);
    db.run(
      `CREATE TRIGGER fail_next_occurrence BEFORE INSERT ON items BEGIN SELECT RAISE(ABORT, 'insert failed'); END`
    );
    try {
      expect(() => toggleItemCompleted(db, owner, id, T0)).toThrow();
    } finally {
      db.run(`DROP TRIGGER fail_next_occurrence`);
    }
    expect(itemsIn(bucketId)).toEqual(before);
  });
});

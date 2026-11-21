import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { itemReminders, items, syncState } from "@/lib/db/schema";
import { deleteItem } from "@/lib/items/delete";
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

beforeEach(() => useSchedulerEnvironment(T0));
afterEach(() => resetSchedulerEnvironment());

const itemOf = (id: string) => db.select().from(items).where(eq(items.id, id)).get();
const remindersOf = (id: string) =>
  db.select().from(itemReminders).where(eq(itemReminders.itemId, id)).all();
const counter = () => db.select().from(syncState).get()?.rev ?? 0;

async function itemInBucket() {
  const owner = await seedUser();
  const bucketId = await seedBucket(owner);
  const id = await seedItem(owner, bucketId, { deadline: new Date(T0.getTime() + HOUR) });
  return { owner, bucketId, id };
}

describe("deleteItem", () => {
  it("moves the item to the trash for the person who deleted it and clears its reminders", async () => {
    const { owner, id } = await itemInBucket();
    expect(remindersOf(id).some((r) => r.nextReminderAt || r.nextOverdueAt)).toBe(true);
    const before = counter();

    expect(deleteItem(db, owner, id, T0)).toBe(true);

    expect(itemOf(id)).toMatchObject({ deletedAt: T0, deletedBy: owner });
    expect(remindersOf(id).every((r) => !r.nextReminderAt && !r.nextOverdueAt)).toBe(true);
    expect(counter()).toBeGreaterThan(before);
  });

  it("lets a member of a shared bucket delete", async () => {
    const { bucketId, id } = await itemInBucket();
    const friend = await seedUser();
    await seedMember(bucketId, friend);

    expect(deleteItem(db, friend, id, T0)).toBe(true);
    expect(itemOf(id)?.deletedBy).toBe(friend);
  });

  it("refuses someone outside the bucket and changes nothing", async () => {
    const { id } = await itemInBucket();
    const stranger = await seedUser();
    const before = { item: itemOf(id), reminders: remindersOf(id), counter: counter() };

    expect(deleteItem(db, stranger, id, T0)).toBe(false);

    expect({ item: itemOf(id), reminders: remindersOf(id), counter: counter() }).toEqual(before);
  });

  it("refuses an item that is already in the trash and keeps who deleted it first", async () => {
    const { owner, bucketId, id } = await itemInBucket();
    const friend = await seedUser();
    await seedMember(bucketId, friend);
    deleteItem(db, owner, id, T0);

    expect(deleteItem(db, friend, id, new Date(T0.getTime() + HOUR))).toBe(false);
    expect(itemOf(id)).toMatchObject({ deletedAt: T0, deletedBy: owner });
  });

  it("is undone with the surrounding transaction", async () => {
    const { owner, id } = await itemInBucket();
    const before = { item: itemOf(id), reminders: remindersOf(id), counter: counter() };

    expect(() =>
      db.transaction((tx) => {
        expect(deleteItem(tx, owner, id, T0)).toBe(true);
        throw new Error("halfway");
      })
    ).toThrow("halfway");

    expect({ item: itemOf(id), reminders: remindersOf(id), counter: counter() }).toEqual(before);
  });

  it("undoes the item when refreshing its reminders fails", async () => {
    const { owner, id } = await itemInBucket();
    db.run(
      `CREATE TRIGGER fail_reminder_refresh BEFORE UPDATE ON item_reminders BEGIN SELECT RAISE(ABORT, 'refresh failed'); END`
    );
    try {
      expect(() => deleteItem(db, owner, id, T0)).toThrow();
    } finally {
      db.run(`DROP TRIGGER fail_reminder_refresh`);
    }
    expect(itemOf(id)?.deletedAt).toBeNull();
  });
});

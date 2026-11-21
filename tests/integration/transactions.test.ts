import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  bucketMembers,
  itemAssignees,
  itemReminders,
  items,
  syncState,
  syncTombstones,
} from "@/lib/db/schema";
import { ITEM_STATUS } from "@/constants";
import { assignEveryone, setItemAssignees } from "@/lib/items/assignees";
import { toggleItemCompleted } from "@/lib/items/complete";
import { moveOccurrence } from "@/lib/items/recurrence";
import { refreshItemReminders } from "@/lib/reminders/refresh";
import {
  HOUR,
  resetSchedulerEnvironment,
  seedBucket,
  seedItem,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

const T0 = new Date("2026-03-10T12:00:00Z");
const MONTHLY = JSON.stringify({ enabled: true, frequency: "monthly", interval: 1 });

beforeEach(() => useSchedulerEnvironment(T0));
afterEach(() => resetSchedulerEnvironment());

const boom = new Error("something failed halfway");

// Everything a rule can write, so a rolled back transaction is shown to leave none of it
function snapshot() {
  return {
    items: db.select().from(items).orderBy(items.id).all(),
    assignees: db.select().from(itemAssignees).orderBy(itemAssignees.id).all(),
    reminders: db.select().from(itemReminders).orderBy(itemReminders.id).all(),
    tombstones: db.select().from(syncTombstones).all(),
    counter: db.select().from(syncState).get()?.rev,
  };
}

async function recurringItem() {
  const userId = await seedUser();
  const bucketId = await seedBucket(userId);
  const id = await seedItem(userId, bucketId, { deadline: new Date(T0.getTime() + HOUR) });
  db.update(items).set({ recurring: MONTHLY }).where(eq(items.id, id)).run();
  return { userId, bucketId, id };
}

describe("the item helpers join a surrounding transaction", () => {
  it("a new item, who it is for and its reminders are undone together", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);
    const before = snapshot();

    expect(() =>
      db.transaction((tx) => {
        const item = tx
          .insert(items)
          .values({ bucketId, userId, title: "pay rent", deadline: new Date(T0.getTime() + HOUR) })
          .returning()
          .get();
        assignEveryone(tx, item.id, bucketId);
        refreshItemReminders(tx, [item.id]);
        expect(
          tx.select().from(itemReminders).where(eq(itemReminders.itemId, item.id)).all()
        ).toHaveLength(1);
        throw boom;
      })
    ).toThrow(boom);

    expect(snapshot()).toEqual(before);
  });

  it("ticking a repeating item and the next occurrence it creates are undone together", async () => {
    const { userId, id } = await recurringItem();
    const item = db.select().from(items).where(eq(items.id, id)).get();
    expect(item).toBeDefined();
    const before = snapshot();

    expect(() =>
      db.transaction((tx) => {
        toggleItemCompleted(tx, item as typeof items.$inferSelect, userId, T0);
        expect(tx.select().from(items).all().length).toBe(before.items.length + 1);
        throw boom;
      })
    ).toThrow(boom);

    expect(snapshot()).toEqual(before);
    expect(db.select().from(items).where(eq(items.id, id)).get()?.status).toBe(ITEM_STATUS.active);
  });

  it("moving a date and its refreshed reminders are undone together", async () => {
    const { userId, id } = await recurringItem();
    const before = snapshot();

    expect(() =>
      db.transaction((tx) => {
        const result = moveOccurrence(tx, userId, id, new Date(T0.getTime() + 5 * HOUR), T0);
        expect(result.ok).toBe(true);
        throw boom;
      })
    ).toThrow(boom);

    expect(snapshot()).toEqual(before);
  });

  it("a change to who an item is for, which is its own transaction inside, is undone with the outer one", async () => {
    const { userId, bucketId, id } = await recurringItem();
    const other = await seedUser();
    db.insert(bucketMembers).values({ bucketId, userId: other }).run();
    const before = snapshot();

    expect(() =>
      db.transaction((tx) => {
        setItemAssignees(tx, id, [userId, other]);
        refreshItemReminders(tx, [id]);
        throw boom;
      })
    ).toThrow(boom);

    expect(snapshot()).toEqual(before);
  });

  it("keeps everything when nothing fails, and the work is numbered as it commits", async () => {
    const { userId, id } = await recurringItem();
    const item = db.select().from(items).where(eq(items.id, id)).get();
    const before = snapshot();

    db.transaction((tx) => {
      toggleItemCompleted(tx, item as typeof items.$inferSelect, userId, T0);
    });

    const after = snapshot();
    expect(after.items.length).toBe(before.items.length + 1);
    expect(after.counter).toBeGreaterThan(before.counter ?? 0);
    expect(db.select().from(items).where(eq(items.id, id)).get()?.status).toBe(
      ITEM_STATUS.completed
    );
  });

  it("works the same on the database itself as inside a transaction", async () => {
    const { userId, bucketId, id } = await recurringItem();
    const other = await seedUser();
    db.insert(bucketMembers).values({ bucketId, userId: other }).run();

    setItemAssignees(db, id, [other]);
    const viaDb = db.select().from(itemAssignees).where(eq(itemAssignees.itemId, id)).all();
    db.transaction((tx) => setItemAssignees(tx, id, [userId]));
    const viaTx = db.select().from(itemAssignees).where(eq(itemAssignees.itemId, id)).all();

    expect(viaDb.map((r) => r.userId)).toEqual([other]);
    expect(viaTx.map((r) => r.userId)).toEqual([userId]);
  });
});

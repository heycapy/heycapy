import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { itemAssignees, itemReminders, items, syncState } from "@/lib/db/schema";
import { ITEM_GONE_ERROR, NOT_A_MEMBER_ERROR } from "@/constants";
import { assignItem } from "@/lib/items/assign";
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
const assigneesOf = (id: string) =>
  db
    .select()
    .from(itemAssignees)
    .where(eq(itemAssignees.itemId, id))
    .orderBy(itemAssignees.id)
    .all()
    .map((a) => a.userId);
const reminderUsers = (id: string) =>
  db
    .select()
    .from(itemReminders)
    .where(eq(itemReminders.itemId, id))
    .all()
    .filter((r) => r.nextReminderAt || r.nextOverdueAt)
    .map((r) => r.userId)
    .sort();
const counter = () => db.select().from(syncState).get()?.rev ?? 0;
const state = (id: string) => ({
  item: itemOf(id),
  assignees: assigneesOf(id),
  reminders: reminderUsers(id),
  counter: counter(),
});

async function shared() {
  const owner = await seedUser();
  const friend = await seedUser();
  const stranger = await seedUser();
  const bucketId = await seedBucket(owner);
  await seedMember(bucketId, friend);
  const id = await seedItem(owner, bucketId, {
    deadline: new Date(T0.getTime() + HOUR),
    assigneeIds: [owner, friend],
  });
  return { owner, friend, stranger, id };
}

describe("assignItem", () => {
  it("changes who the item is for and who is reminded", async () => {
    const { owner, friend, id } = await shared();
    expect(reminderUsers(id)).toEqual([owner, friend].sort());

    expect(assignItem(db, friend, id, [friend], T0)).toEqual({ ok: true });

    expect(assigneesOf(id)).toEqual([friend]);
    expect(reminderUsers(id)).toEqual([friend]);
    expect(itemOf(id)?.updatedAt).toEqual(T0);
  });

  it("can make an item be for no one", async () => {
    const { owner, id } = await shared();

    expect(assignItem(db, owner, id, [], T0)).toEqual({ ok: true });

    expect(assigneesOf(id)).toEqual([]);
  });

  it("refuses someone outside the bucket and changes nothing", async () => {
    const { stranger, id } = await shared();
    const before = state(id);

    expect(assignItem(db, stranger, id, [stranger], T0)).toEqual({
      ok: false,
      error: ITEM_GONE_ERROR,
    });
    expect(state(id)).toEqual(before);
  });

  it("refuses an assignee who isn't in the bucket and changes nothing", async () => {
    const { owner, stranger, id } = await shared();
    const before = state(id);

    expect(assignItem(db, owner, id, [owner, stranger], T0)).toEqual({
      ok: false,
      error: NOT_A_MEMBER_ERROR,
    });
    expect(state(id)).toEqual(before);
  });

  it("is undone with the surrounding transaction", async () => {
    const { owner, id } = await shared();
    const before = state(id);

    expect(() =>
      db.transaction((tx) => {
        expect(assignItem(tx, owner, id, [owner], T0)).toEqual({ ok: true });
        throw new Error("halfway");
      })
    ).toThrow("halfway");

    expect(state(id)).toEqual(before);
  });

  it("undoes the new list when refreshing the reminders fails", async () => {
    const { owner, id } = await shared();
    const before = state(id);
    db.run(
      `CREATE TRIGGER fail_assign_refresh BEFORE DELETE ON item_reminders BEGIN SELECT RAISE(ABORT, 'refresh failed'); END`
    );
    try {
      expect(() => assignItem(db, owner, id, [owner], T0)).toThrow();
    } finally {
      db.run(`DROP TRIGGER fail_assign_refresh`);
    }
    expect(state(id)).toEqual(before);
  });
});

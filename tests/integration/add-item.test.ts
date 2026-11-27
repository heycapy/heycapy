import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { itemAssignees, itemReminders, items, syncState } from "@/lib/db/schema";
import { ITEM_STATUS, NOT_A_MEMBER_ERROR } from "@/constants";
import { addItem } from "@/lib/items/add";
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

const itemsIn = (bucketId: number) =>
  db.select().from(items).where(eq(items.bucketId, bucketId)).orderBy(items.id).all();
const assigneesOf = (id: string) =>
  db
    .select()
    .from(itemAssignees)
    .where(eq(itemAssignees.itemId, id))
    .orderBy(itemAssignees.id)
    .all()
    .map((a) => a.userId);
const remindersOf = (id: string) =>
  db.select().from(itemReminders).where(eq(itemReminders.itemId, id)).all();
const counter = () => db.select().from(syncState).get()?.rev ?? 0;

async function setup() {
  const owner = await seedUser();
  const friend = await seedUser();
  const bucketId = await seedBucket(owner);
  await seedMember(bucketId, friend);
  return { owner, friend, bucketId };
}

function created(result: ReturnType<typeof addItem>) {
  if (!result.ok) throw new Error(result.error);
  return result.id;
}

describe("addItem", () => {
  it("adds an item for everyone with a schedule, last in the list", async () => {
    const { owner, friend, bucketId } = await setup();
    await seedItem(owner, bucketId, { deadline: new Date(T0.getTime() + HOUR) });
    const [first] = itemsIn(bucketId);

    const id = created(
      addItem(
        db,
        owner,
        { bucketId, title: "  pay the rent  ", deadline: "2026-03-20", description: " notes " },
        T0
      )
    );

    const row = itemsIn(bucketId).find((i) => i.id === id);
    expect(row).toMatchObject({
      title: "pay the rent",
      description: "notes",
      userId: owner,
      status: ITEM_STATUS.active,
      sortOrder: first.sortOrder + 1,
    });
    expect(row?.deadline).not.toBeNull();
    expect(assigneesOf(id)).toEqual([owner, friend]);
    expect(remindersOf(id).some((r) => r.nextReminderAt || r.nextOverdueAt)).toBe(true);
  });

  it("starts the first item of a bucket at the top", async () => {
    const { owner, bucketId } = await setup();

    const id = created(addItem(db, owner, { bucketId, title: "one", deadline: null }, T0));

    expect(itemsIn(bucketId).find((i) => i.id === id)?.sortOrder).toBe(0);
  });

  it("records who completed an item added as completed", async () => {
    const { owner, bucketId } = await setup();

    const id = created(
      addItem(
        db,
        owner,
        { bucketId, title: "done", deadline: null, status: ITEM_STATUS.completed },
        T0
      )
    );

    expect(itemsIn(bucketId).find((i) => i.id === id)).toMatchObject({
      status: ITEM_STATUS.completed,
      completedAt: T0,
      completedBy: owner,
    });
  });

  it("keeps who it is for when the list is given, including no one", async () => {
    const { owner, friend, bucketId } = await setup();

    const one = created(
      addItem(db, owner, { bucketId, title: "a", deadline: null, assigneeIds: [friend] }, T0)
    );
    const none = created(
      addItem(db, owner, { bucketId, title: "b", deadline: null, assigneeIds: [] }, T0)
    );

    expect(assigneesOf(one)).toEqual([friend]);
    expect(assigneesOf(none)).toEqual([]);
  });

  it("lets a member of a shared bucket add", async () => {
    const { friend, bucketId } = await setup();

    expect(addItem(db, friend, { bucketId, title: "mine", deadline: null }, T0).ok).toBe(true);
  });

  it("refuses bad input and changes nothing", async () => {
    const { owner, bucketId } = await setup();
    const stranger = await seedUser();
    const before = { items: itemsIn(bucketId), counter: counter() };
    const add = (input: Partial<Parameters<typeof addItem>[2]>, who = owner) =>
      addItem(db, who, { bucketId, title: "x", deadline: null, ...input }, T0);

    expect(add({ title: "  " }).ok).toBe(false);
    expect(add({ reminders: [-5] }).ok).toBe(false);
    expect(add({ clock: "Mars/Olympus" }).ok).toBe(false);
    expect(add({ status: "nonsense" }).ok).toBe(false);
    expect(add({ assigneeIds: [stranger] })).toEqual({ ok: false, error: NOT_A_MEMBER_ERROR });
    expect(add({}, stranger)).toEqual({ ok: false, error: "Bucket not found" });

    expect({ items: itemsIn(bucketId), counter: counter() }).toEqual(before);
  });

  it("is undone with the surrounding transaction", async () => {
    const { owner, bucketId } = await setup();
    const before = { items: itemsIn(bucketId), counter: counter() };

    expect(() =>
      db.transaction((tx) => {
        expect(addItem(tx, owner, { bucketId, title: "x", deadline: "2026-03-20" }, T0).ok).toBe(
          true
        );
        throw new Error("halfway");
      })
    ).toThrow("halfway");

    expect({ items: itemsIn(bucketId), counter: counter() }).toEqual(before);
  });

  it("undoes the item when refreshing the reminders fails", async () => {
    const { owner, bucketId } = await setup();
    const before = { items: itemsIn(bucketId), counter: counter() };
    db.run(
      `CREATE TRIGGER fail_add_refresh BEFORE INSERT ON item_reminders BEGIN SELECT RAISE(ABORT, 'refresh failed'); END`
    );
    try {
      expect(() =>
        addItem(db, owner, { bucketId, title: "x", deadline: "2026-03-20" }, T0)
      ).toThrow();
    } finally {
      db.run(`DROP TRIGGER fail_add_refresh`);
    }
    expect({ items: itemsIn(bucketId), counter: counter() }).toEqual(before);
  });
});

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { itemAssignees, itemReminders, items, syncState } from "@/lib/db/schema";
import { ITEM_GONE_ERROR, ITEM_STATUS, NOT_A_MEMBER_ERROR } from "@/constants";
import { updateItem } from "@/lib/items/update";
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
const MONTHLY = { enabled: true, frequency: "monthly", interval: 1 } as const;

beforeEach(() => useSchedulerEnvironment(T0));
afterEach(() => resetSchedulerEnvironment());

const itemsIn = (bucketId: number) =>
  db.select().from(items).where(eq(items.bucketId, bucketId)).orderBy(items.id).all();
const state = (bucketId: number, id: string) => ({
  items: itemsIn(bucketId),
  reminders: db.select().from(itemReminders).where(eq(itemReminders.itemId, id)).all(),
  assignees: db.select().from(itemAssignees).where(eq(itemAssignees.itemId, id)).all(),
  counter: db.select().from(syncState).get()?.rev,
});

async function setup(recurring?: typeof MONTHLY) {
  const owner = await seedUser();
  const friend = await seedUser();
  const bucketId = await seedBucket(owner);
  await seedMember(bucketId, friend);
  const id = await seedItem(owner, bucketId, {
    deadline: new Date(T0.getTime() + HOUR),
    assigneeIds: [owner, friend],
  });
  if (recurring) {
    db.update(items)
      .set({ recurring: JSON.stringify(recurring) })
      .where(eq(items.id, id))
      .run();
  }
  return { owner, friend, bucketId, id };
}

function failing(trigger: string, sql: string, run: () => void) {
  db.run(`CREATE TRIGGER ${trigger} ${sql}`);
  try {
    expect(run).toThrow();
  } finally {
    db.run(`DROP TRIGGER ${trigger}`);
  }
}

describe("updateItem", () => {
  it("applies only what the patch carries, stamped with the given time", async () => {
    const { owner, bucketId, id } = await setup();
    const before = itemsIn(bucketId)[0];

    expect(updateItem(db, owner, id, { title: "  pay the rent  " }, T0)).toEqual({ ok: true });

    const after = itemsIn(bucketId)[0];
    expect(after).toMatchObject({ title: "pay the rent", updatedAt: T0 });
    expect(after.deadline).toEqual(before.deadline);
    expect(after.status).toBe(before.status);
  });

  it("completing through a patch records who and creates the next occurrence", async () => {
    const { owner, bucketId, id } = await setup(MONTHLY);

    expect(updateItem(db, owner, id, { status: ITEM_STATUS.completed }, T0)).toEqual({ ok: true });

    const rows = itemsIn(bucketId);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.id === id)).toMatchObject({
      status: ITEM_STATUS.completed,
      completedAt: T0,
      completedBy: owner,
    });
  });

  it("changes the date and who the item is for together", async () => {
    const { owner, friend, bucketId, id } = await setup();

    expect(
      updateItem(db, owner, id, { deadline: "2026-03-20", assigneeIds: [friend] }, T0)
    ).toEqual({ ok: true });

    expect(itemsIn(bucketId)[0].deadline?.getTime()).toBeGreaterThan(T0.getTime() + 5 * 24 * HOUR);
    expect(state(bucketId, id).assignees.map((a) => a.userId)).toEqual([friend]);
  });

  it("refuses bad input and changes nothing", async () => {
    const { owner, bucketId, id } = await setup();
    const stranger = await seedUser();
    const before = state(bucketId, id);

    expect(updateItem(db, owner, id, { title: "  " }, T0).ok).toBe(false);
    expect(updateItem(db, owner, id, { reminders: [-5] }, T0).ok).toBe(false);
    expect(updateItem(db, owner, id, { clock: "Mars/Olympus" }, T0).ok).toBe(false);
    expect(updateItem(db, owner, id, { status: "nonsense" }, T0).ok).toBe(false);
    expect(updateItem(db, owner, id, { assigneeIds: [stranger] }, T0)).toEqual({
      ok: false,
      error: NOT_A_MEMBER_ERROR,
    });
    expect(updateItem(db, stranger, id, { title: "mine" }, T0)).toEqual({
      ok: false,
      error: ITEM_GONE_ERROR,
    });

    expect(state(bucketId, id)).toEqual(before);
  });

  it("is undone with the surrounding transaction", async () => {
    const { owner, friend, bucketId, id } = await setup(MONTHLY);
    const before = state(bucketId, id);

    expect(() =>
      db.transaction((tx) => {
        const patch = { deadline: "2026-03-20", assigneeIds: [friend], status: "completed" };
        expect(updateItem(tx, owner, id, patch, T0)).toEqual({ ok: true });
        throw new Error("halfway");
      })
    ).toThrow("halfway");

    expect(state(bucketId, id)).toEqual(before);
  });

  it("undoes the edit when refreshing the reminders fails", async () => {
    const { owner, friend, bucketId, id } = await setup();
    const before = state(bucketId, id);

    failing(
      "fail_patch_refresh",
      "BEFORE DELETE ON item_reminders BEGIN SELECT RAISE(ABORT, 'refresh failed'); END",
      () => updateItem(db, owner, id, { title: "new", assigneeIds: [friend] }, T0)
    );

    expect(state(bucketId, id)).toEqual(before);
  });

  it("undoes the tick when creating the next occurrence fails", async () => {
    const { owner, bucketId, id } = await setup(MONTHLY);
    const before = state(bucketId, id);

    failing(
      "fail_patch_next",
      "BEFORE INSERT ON items BEGIN SELECT RAISE(ABORT, 'insert failed'); END",
      () => updateItem(db, owner, id, { status: ITEM_STATUS.completed }, T0)
    );

    expect(state(bucketId, id)).toEqual(before);
  });
});

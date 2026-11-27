import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { dataEvents } from "@/lib/events";
import { reorderItems } from "@/lib/items/reorder";
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

const rowOf = (id: string) => db.select().from(items).where(eq(items.id, id)).get();
const orderIn = (bucketId: number) =>
  db
    .select()
    .from(items)
    .where(eq(items.bucketId, bucketId))
    .orderBy(items.sortOrder)
    .all()
    .map((i) => i.id);

async function bucketOf(count: number) {
  const owner = await seedUser();
  const bucketId = await seedBucket(owner);
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const id = await seedItem(owner, bucketId, { deadline: new Date(T0.getTime() + HOUR) });
    db.update(items).set({ sortOrder: i }).where(eq(items.id, id)).run();
    ids.push(id);
  }
  return { owner, bucketId, ids };
}

describe("reorderItems", () => {
  it("puts the items in the order given", async () => {
    const { owner, bucketId, ids } = await bucketOf(3);
    const [a, b, c] = ids;

    expect(reorderItems(db, owner, bucketId, [c, a, b])).toEqual({ ok: true });

    expect(orderIn(bucketId)).toEqual([c, a, b]);
  });

  it("writes only the rows that moved", async () => {
    const { owner, bucketId, ids } = await bucketOf(3);
    const [a, b, c] = ids;
    const revs = ids.map((id) => rowOf(id)?.rev);

    reorderItems(db, owner, bucketId, [a, c, b]);

    expect(rowOf(a)?.rev).toBe(revs[0]);
    expect(rowOf(b)?.rev).toBeGreaterThan(revs[1] ?? 0);
    expect(rowOf(c)?.rev).toBeGreaterThan(revs[2] ?? 0);
  });

  it("skips an id from another bucket and leaves that bucket alone", async () => {
    const { owner, bucketId, ids } = await bucketOf(2);
    const other = await bucketOf(1);
    const [foreign] = other.ids;
    const before = rowOf(foreign);

    expect(reorderItems(db, owner, bucketId, [foreign, ids[1], ids[0]])).toEqual({ ok: true });

    expect(rowOf(foreign)).toEqual(before);
    expect(rowOf(ids[1])?.sortOrder).toBe(1);
    expect(rowOf(ids[0])?.sortOrder).toBe(2);
  });

  it("lets a member of a shared bucket reorder", async () => {
    const { bucketId, ids } = await bucketOf(2);
    const friend = await seedUser();
    await seedMember(bucketId, friend);

    expect(reorderItems(db, friend, bucketId, [ids[1], ids[0]])).toEqual({ ok: true });
    expect(orderIn(bucketId)).toEqual([ids[1], ids[0]]);
  });

  it("refuses someone outside the bucket and changes nothing", async () => {
    const { bucketId, ids } = await bucketOf(2);
    const stranger = await seedUser();

    expect(reorderItems(db, stranger, bucketId, [ids[1], ids[0]])).toEqual({
      ok: false,
      error: "Bucket not found",
    });
    expect(orderIn(bucketId)).toEqual(ids);
  });

  it("tells the bucket's watchers once", async () => {
    const { owner, bucketId, ids } = await bucketOf(3);
    const seen: number[] = [];
    const listen = (id: number) => seen.push(id);
    dataEvents.on("bucket", listen);
    try {
      reorderItems(db, owner, bucketId, [ids[2], ids[1], ids[0]]);
    } finally {
      dataEvents.off("bucket", listen);
    }
    expect(seen).toEqual([bucketId]);
  });

  it("is undone with the surrounding transaction", async () => {
    const { owner, bucketId, ids } = await bucketOf(3);

    expect(() =>
      db.transaction((tx) => {
        expect(reorderItems(tx, owner, bucketId, [ids[2], ids[1], ids[0]])).toEqual({ ok: true });
        throw new Error("halfway");
      })
    ).toThrow("halfway");

    expect(orderIn(bucketId)).toEqual(ids);
  });

  it("undoes the rows already moved when a later one fails", async () => {
    const { owner, bucketId, ids } = await bucketOf(3);
    db.run(
      `CREATE TRIGGER fail_reorder BEFORE UPDATE OF sort_order ON items WHEN NEW.sort_order = 2 BEGIN SELECT RAISE(ABORT, 'write failed'); END`
    );
    try {
      expect(() => reorderItems(db, owner, bucketId, [ids[2], ids[1], ids[0]])).toThrow();
    } finally {
      db.run(`DROP TRIGGER fail_reorder`);
    }
    expect(orderIn(bucketId)).toEqual(ids);
  });
});

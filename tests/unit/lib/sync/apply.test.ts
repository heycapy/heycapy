import { describe, expect, it } from "vitest";
import { applyPage, recordKey } from "@/lib/sync/client/apply";
import type { PullPage, StoredRecord, WireRecord } from "@/lib/sync/client/types";
import type { PullTombstone } from "@/lib/sync/pull";

const ME = 1;
const A = "00000000-0000-7000-8000-00000000000a";
const B = "00000000-0000-7000-8000-00000000000b";

const bucket = (id: number): WireRecord => ({
  entity: "bucket",
  id,
  rev: 1,
  data: { id, name: `bucket ${id}` } as Extract<WireRecord, { entity: "bucket" }>["data"],
});
const member = (id: number, bucketId: number, userId: number): WireRecord => ({
  entity: "bucket_member",
  id,
  rev: 1,
  data: { bucketId, userId } as Extract<WireRecord, { entity: "bucket_member" }>["data"],
});
const item = (id: string, bucketId: number, title = "t"): WireRecord => ({
  entity: "item",
  id,
  rev: 1,
  data: { id, bucketId, title } as Extract<WireRecord, { entity: "item" }>["data"],
});
const reminder = (itemId: string): WireRecord => ({
  entity: "item_reminder",
  id: itemId,
  rev: 1,
  data: { itemId } as Extract<WireRecord, { entity: "item_reminder" }>["data"],
});

const stored = (r: WireRecord): StoredRecord => {
  const bucketId =
    r.entity === "bucket" ? r.id : r.entity === "item_reminder" ? null : r.data.bucketId;
  return { ...r, key: recordKey(r.entity, r.id), bucketId };
};
const tombstone = (t: Partial<PullTombstone> & Pick<PullTombstone, "entity" | "id">) => ({
  rev: 2,
  bucketId: null,
  userId: null,
  ...t,
});
const page = (records: WireRecord[], tombstones: PullTombstone[] = []): PullPage => ({
  reset: false,
  cursor: 5,
  more: false,
  records,
  tombstones,
});

function run(existing: WireRecord[], p: PullPage) {
  const { puts, deletes } = applyPage(existing.map(stored), p, ME);
  const map = new Map(existing.map((r) => [recordKey(r.entity, r.id), stored(r)]));
  for (const k of deletes) map.delete(k);
  for (const r of puts) map.set(r.key, r);
  return { keys: [...map.keys()].sort(), puts, deletes };
}

describe("applyPage", () => {
  it("stores records under entity and id with the bucket they belong to", () => {
    const { puts } = applyPage(
      [],
      page([bucket(1), member(7, 1, ME), item(A, 1), reminder(A)]),
      ME
    );
    expect(puts.map((r) => [r.key, r.bucketId])).toEqual([
      ["bucket:1", 1],
      ["bucket_member:7", 1],
      [`item:${A}`, 1],
      [`item_reminder:${A}`, null],
    ]);
  });

  it("replaces a row it already has", () => {
    const { puts } = applyPage([stored(item(A, 1, "old"))], page([item(A, 1, "new")]), ME);
    expect(puts).toHaveLength(1);
    expect(puts[0]).toMatchObject({ data: { title: "new" } });
  });

  it("applies deletes before records, so a later-numbered delete cannot remove a joined row", () => {
    const { keys } = run(
      [],
      page([bucket(1), item(A, 1)], [tombstone({ entity: "item", id: A, bucketId: 1, rev: 99 })])
    );
    expect(keys).toEqual(["bucket:1", `item:${A}`]);
  });

  it("an item tombstone deletes the item and its reminder", () => {
    const { keys } = run(
      [bucket(1), item(A, 1), reminder(A)],
      page([], [tombstone({ entity: "item", id: A, bucketId: 1 })])
    );
    expect(keys).toEqual(["bucket:1"]);
  });

  it("an item tombstone for the old bucket leaves an item that moved", () => {
    const { keys } = run(
      [bucket(1), bucket(2), item(A, 2), reminder(A)],
      page([], [tombstone({ entity: "item", id: A, bucketId: 1 })])
    );
    expect(keys).toEqual(["bucket:1", "bucket:2", `item:${A}`, `item_reminder:${A}`]);
  });

  it("a move that arrives with its old-bucket tombstone in the same page keeps the item", () => {
    const { keys } = run(
      [bucket(1), bucket(2), item(A, 1)],
      page([item(A, 2)], [tombstone({ entity: "item", id: A, bucketId: 1 })])
    );
    expect(keys).toEqual(["bucket:1", "bucket:2", `item:${A}`]);
  });

  it("my own membership tombstone deletes the bucket with its members, items and reminders", () => {
    const { keys } = run(
      [
        bucket(1),
        member(7, 1, ME),
        member(8, 1, 2),
        item(A, 1),
        reminder(A),
        bucket(2),
        item(B, 2),
      ],
      page([], [tombstone({ entity: "bucket_member", id: "7", bucketId: 1, userId: ME })])
    );
    expect(keys).toEqual(["bucket:2", `item:${B}`]);
  });

  it("another person's membership tombstone deletes only that member", () => {
    const { keys } = run(
      [bucket(1), member(7, 1, ME), member(8, 1, 2), item(A, 1)],
      page([], [tombstone({ entity: "bucket_member", id: "8", bucketId: 1, userId: 2 })])
    );
    expect(keys).toEqual(["bucket:1", "bucket_member:7", `item:${A}`]);
  });

  it("a bucket tombstone deletes everything in it", () => {
    const { keys } = run(
      [bucket(1), member(7, 1, ME), item(A, 1), reminder(A), bucket(2)],
      page([], [tombstone({ entity: "bucket", id: "1", bucketId: 1 })])
    );
    expect(keys).toEqual(["bucket:2"]);
  });

  it("a reminder tombstone deletes only the reminder", () => {
    const { keys } = run(
      [bucket(1), item(A, 1), reminder(A)],
      page([], [tombstone({ entity: "item_reminder", id: A, userId: ME })])
    );
    expect(keys).toEqual(["bucket:1", `item:${A}`]);
  });

  it("keeps a reminder only when its item is there", () => {
    expect(run([], page([reminder(A)])).keys).toEqual([]);
    expect(run([], page([item(A, 1), reminder(A)])).keys).toEqual([
      `item:${A}`,
      `item_reminder:${A}`,
    ]);
    expect(run([item(A, 1)], page([reminder(A)])).keys).toEqual([
      `item:${A}`,
      `item_reminder:${A}`,
    ]);
  });

  it("an item that comes back brings its reminder back", () => {
    const { keys } = run(
      [bucket(1)],
      page([item(A, 1), reminder(A)], [tombstone({ entity: "item", id: A, bucketId: 1 })])
    );
    expect(keys).toEqual(["bucket:1", `item:${A}`, `item_reminder:${A}`]);
  });

  it("reports no delete for a row it never had", () => {
    const { deletes } = applyPage(
      [],
      page([], [tombstone({ entity: "item", id: A, bucketId: 1 })]),
      ME
    );
    expect(deletes).toEqual([]);
  });
});

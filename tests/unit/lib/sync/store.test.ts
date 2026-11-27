import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { META_CURSOR, META_SCHEMA, META_USER_ID } from "@/lib/sync/client/constants";
import { applyPullPage, readMeta, readRecords, resetRecords } from "@/lib/sync/client/store";
import type { PullPage, WireRecord } from "@/lib/sync/client/types";

const A = "00000000-0000-7000-8000-00000000000a";
const bucket: WireRecord = {
  entity: "bucket",
  id: 1,
  rev: 1,
  data: { id: 1, name: "home" } as Extract<WireRecord, { entity: "bucket" }>["data"],
};
const item = (title: string): WireRecord => ({
  entity: "item",
  id: A,
  rev: 2,
  data: { id: A, bucketId: 1, title } as Extract<WireRecord, { entity: "item" }>["data"],
});
const page = (cursor: number, records: WireRecord[], tombstones: PullPage["tombstones"] = []) => ({
  reset: false as const,
  cursor,
  more: false,
  records,
  tombstones,
});

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe("sync store", () => {
  it("saves a page with the cursor, schema and owner in one go", async () => {
    await applyPullPage(page(4, [bucket, item("a")]), 9, 1);
    expect((await readRecords()).map((r) => r.key).sort()).toEqual(
      [`item:${A}`, "bucket:1"].sort()
    );
    expect(await readMeta(META_CURSOR)).toBe(4);
    expect(await readMeta(META_SCHEMA)).toBe(1);
    expect(await readMeta(META_USER_ID)).toBe(9);
  });

  it("applies a later page on top of the saved rows", async () => {
    await applyPullPage(page(4, [bucket, item("a")]), 9, 1);
    await applyPullPage(
      page(6, [item("b")], [{ entity: "bucket", id: "7", rev: 5, bucketId: 7, userId: null }]),
      9,
      1
    );
    const rows = await readRecords();
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.entity === "item")).toMatchObject({ data: { title: "b" } });
    expect(await readMeta(META_CURSOR)).toBe(6);
  });

  it("leaves the rows and the cursor as they were when the write fails", async () => {
    await applyPullPage(page(4, [bucket]), 9, 1);
    const unclonable = { id: A, bucketId: 1, fn: () => 1 };
    const broken = { ...item("x"), data: unclonable } as unknown as WireRecord;
    await expect(applyPullPage(page(8, [broken]), 9, 1)).rejects.toBeDefined();
    expect((await readRecords()).map((r) => r.key)).toEqual(["bucket:1"]);
    expect(await readMeta(META_CURSOR)).toBe(4);
  });

  it("a reset clears the rows and sets the cursor back to 0", async () => {
    await applyPullPage(page(4, [bucket, item("a")]), 9, 1);
    await resetRecords();
    expect(await readRecords()).toEqual([]);
    expect(await readMeta(META_CURSOR)).toBe(0);
  });

  it("starts empty", async () => {
    expect(await readRecords()).toEqual([]);
    expect(await readMeta(META_CURSOR)).toBeUndefined();
  });
});

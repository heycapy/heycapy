import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recordKey } from "@/lib/sync/client/apply";
import { keepStorage } from "@/lib/sync/client/persist";
import { readQueue, settle, enqueue } from "@/lib/sync/client/queue";
import {
  dismissRejections,
  readRejections,
  rejectionMessage,
  rejectionTitle,
  takeNewRejections,
} from "@/lib/sync/client/rejections";
import { readRecords } from "@/lib/sync/client/store";
import type { NewMutation, StoredRecord } from "@/lib/sync/client/types";

const A = "00000000-0000-7000-8000-00000000000a";

const itemRecord = (title: string): StoredRecord =>
  ({
    entity: "item",
    id: A,
    rev: 1,
    data: { id: A, bucketId: 1, title },
    key: recordKey("item", A),
    bucketId: 1,
  }) as StoredRecord;

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

const refusal = {
  mutation: { type: "item.delete", id: A } as NewMutation,
  title: "x",
  reason: "r",
};

describe("rejectionTitle", () => {
  it("names a created item by what was typed", () => {
    const create: NewMutation = {
      type: "item.create",
      id: A,
      bucketId: 1,
      title: " pay rent ",
      deadline: null,
    };
    expect(rejectionTitle([], create)).toBe("pay rent");
  });

  it("names an edited or deleted item from the device's copy, if it has one", () => {
    expect(rejectionTitle([itemRecord("pay rent")], { type: "item.delete", id: A })).toBe(
      "pay rent"
    );
    expect(rejectionTitle([], { type: "item.patch", id: A, patch: { status: "completed" } })).toBe(
      null
    );
  });
});

describe("rejectionMessage", () => {
  it("says what was refused and why", () => {
    expect(rejectionMessage({ title: "pay rent", reason: "no longer a member" })).toBe(
      'couldn\'t save "pay rent": no longer a member'
    );
    expect(rejectionMessage({ title: null, reason: "item is gone" })).toBe(
      "couldn't save: item is gone"
    );
  });
});

describe("takeNewRejections", () => {
  it("hands each refusal over once, even to tabs asking at the same time", async () => {
    await settle([], [refusal, { ...refusal, reason: "second" }]);
    const [first, second] = await Promise.all([takeNewRejections(), takeNewRejections()]);
    expect(first.length + second.length).toBe(2);
    expect(await takeNewRejections()).toEqual([]);
  });

  it("keeps a refusal after it was handed over, until it is dismissed", async () => {
    await settle([], [refusal, { ...refusal, reason: "second" }]);
    await takeNewRejections();
    const kept = await readRejections();
    expect(kept.map((r) => r.reason)).toEqual(["r", "second"]);
    await dismissRejections([kept[0].id]);
    expect((await readRejections()).map((r) => r.reason)).toEqual(["second"]);
  });

  it("settling drops the queue entry and keeps the refusal in the same step", async () => {
    await enqueue({ type: "item.delete", id: A });
    await settle([1], [refusal]);
    expect(await readQueue()).toEqual([]);
    expect((await readRejections()).map((r) => r.reason)).toEqual(["r"]);
  });
});

describe("a database made before refusals were kept", () => {
  it("upgrades without touching the queue or the rows", async () => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("heycapy-sync", 2);
      open.onupgradeneeded = () => {
        const db = open.result;
        db.createObjectStore("records", { keyPath: "key" }).createIndex("bucket", "bucketId");
        db.createObjectStore("meta");
        db.createObjectStore("queue", { keyPath: "seq", autoIncrement: true });
      };
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction(["records", "queue"], "readwrite");
        tx.objectStore("records").put(itemRecord("kept"));
        tx.objectStore("queue").add({ sent: false, mutation: { type: "item.delete", id: A } });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });

    expect((await readQueue()).map((e) => e.mutation.type)).toEqual(["item.delete"]);
    expect((await readRecords()).map((r) => r.key)).toEqual([`item:${A}`]);
    await settle([], [refusal]);
    expect(await readRejections()).toHaveLength(1);
  });
});

describe("keepStorage", () => {
  const original = Object.getOwnPropertyDescriptor(navigator, "storage");
  afterEach(() => {
    if (original) Object.defineProperty(navigator, "storage", original);
    else Reflect.deleteProperty(navigator, "storage");
  });
  const stub = (storage: unknown) =>
    Object.defineProperty(navigator, "storage", { value: storage, configurable: true });

  it("asks once when the storage is not yet persistent", async () => {
    const persist = vi.fn().mockResolvedValue(true);
    stub({ persist, persisted: vi.fn().mockResolvedValue(false) });
    await keepStorage();
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("does not ask again when it already is", async () => {
    const persist = vi.fn();
    stub({ persist, persisted: vi.fn().mockResolvedValue(true) });
    await keepStorage();
    expect(persist).not.toHaveBeenCalled();
  });

  it("does nothing, and does not throw, where the browser has no such call or refuses", async () => {
    stub(undefined);
    await expect(keepStorage()).resolves.toBeUndefined();
    stub({
      persist: vi.fn().mockRejectedValue(new Error("no")),
      persisted: vi.fn().mockResolvedValue(false),
    });
    await expect(keepStorage()).resolves.toBeUndefined();
  });
});

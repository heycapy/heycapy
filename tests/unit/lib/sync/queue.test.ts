import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { enqueue, markSent, planEnqueue, readQueue } from "@/lib/sync/client/queue";
import type { NewMutation, QueueEntry } from "@/lib/sync/client/types";

const A = "00000000-0000-7000-8000-00000000000a";
const B = "00000000-0000-7000-8000-00000000000b";

const create = (id = A, title = "t"): NewMutation => ({
  type: "item.create",
  id,
  bucketId: 1,
  title,
  deadline: null,
});
const patch = (p: Extract<NewMutation, { type: "item.patch" }>["patch"], id = A): NewMutation => ({
  type: "item.patch",
  id,
  patch: p,
});
const del = (id = A): NewMutation => ({ type: "item.delete", id });
const entry = (seq: number, mutation: NewMutation, sent = false): QueueEntry => ({
  seq,
  sent,
  mutation,
});

describe("planEnqueue", () => {
  it("adds a create", () => {
    expect(planEnqueue([], create())).toEqual({ put: [], remove: [], add: create() });
  });

  it("folds a patch into an unsent create", () => {
    const plan = planEnqueue([entry(1, create())], patch({ title: "new", deadline: "2026-01-01" }));
    expect(plan.add).toBeNull();
    expect(plan.put).toEqual([
      entry(1, { ...create(), title: "new", deadline: "2026-01-01" } as NewMutation),
    ]);
  });

  it("a cleared description leaves the create without one", () => {
    const withNote: NewMutation = { ...create(), description: "x" } as NewMutation;
    const plan = planEnqueue([entry(1, withNote)], patch({ description: null }));
    expect(plan.put[0].mutation).not.toHaveProperty("description");
  });

  it("merges a patch into the last unsent patch of the same item, later fields win", () => {
    const plan = planEnqueue(
      [entry(1, patch({ title: "a", status: "open" }))],
      patch({ title: "b" })
    );
    expect(plan.put).toEqual([entry(1, patch({ title: "b", status: "open" }))]);
    expect(plan.add).toBeNull();
  });

  it("does not touch another item's entries", () => {
    const plan = planEnqueue([entry(1, patch({ title: "a" }, B))], patch({ title: "b" }));
    expect(plan).toEqual({ put: [], remove: [], add: patch({ title: "b" }) });
  });

  it("never merges into an entry that was already sent", () => {
    const plan = planEnqueue([entry(1, create(), true)], patch({ title: "b" }));
    expect(plan).toEqual({ put: [], remove: [], add: patch({ title: "b" }) });
    const second = planEnqueue([entry(1, patch({ title: "a" }), true)], patch({ title: "b" }));
    expect(second.add).toEqual(patch({ title: "b" }));
  });

  it("a delete cancels an unsent create and its patches", () => {
    const plan = planEnqueue([entry(1, create()), entry(2, create(B))], del());
    expect(plan).toEqual({ put: [], remove: [1], add: null });
  });

  it("a delete replaces the unsent patches", () => {
    const plan = planEnqueue(
      [entry(1, patch({ title: "a" })), entry(2, patch({ title: "b" }, B))],
      del()
    );
    expect(plan).toEqual({ put: [], remove: [1], add: del() });
  });

  it("a delete after a sent create is sent too", () => {
    const plan = planEnqueue([entry(1, create(), true), entry(2, patch({ title: "a" }))], del());
    expect(plan).toEqual({ put: [], remove: [2], add: del() });
  });
});

describe("queue", () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  it("keeps changes in the order they were made, with rising seqs", async () => {
    await enqueue(create());
    await enqueue(create(B));
    await enqueue(patch({ title: "x" }, B));
    const queue = await readQueue();
    expect(queue.map((e) => e.seq)).toEqual([1, 2]);
    expect(queue[1].mutation).toMatchObject({ type: "item.create", id: B, title: "x" });
  });

  it("a seq is never reused after its entry is gone", async () => {
    await enqueue(create());
    await enqueue(del());
    await enqueue(create(B));
    expect((await readQueue()).map((e) => e.seq)).toEqual([2]);
  });

  it("marks entries sent, and a later edit then goes in as its own change", async () => {
    await enqueue(create());
    await markSent([1]);
    await enqueue(patch({ title: "late" }));
    const queue = await readQueue();
    expect(queue.map((e) => [e.seq, e.sent])).toEqual([
      [1, true],
      [2, false],
    ]);
  });
});

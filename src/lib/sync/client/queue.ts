import { QUEUE_STORE } from "./constants";
import { committed, requestResult, withDatabase } from "./store";
import type { NewMutation, QueueEntry } from "./types";

export type EnqueuePlan = { put: QueueEntry[]; remove: number[]; add: NewMutation | null };

type Patch = Extract<NewMutation, { type: "item.patch" }>["patch"];
type Create = Extract<NewMutation, { type: "item.create" }>;

function foldIntoCreate(create: Create, patch: Patch): Create {
  const { description, ...rest } = patch;
  const folded: Create = { ...create, ...rest };
  if (description !== undefined) {
    if (description === null) delete folded.description;
    else folded.description = description;
  }
  return folded;
}

// Edits to one item before sending merge, and a create followed by a delete cancels out. Only
// entries never sent are touched: the server may already have applied a sent one, and a change
// folded into it would be skipped as a duplicate
export function planEnqueue(entries: QueueEntry[], mutation: NewMutation): EnqueuePlan {
  const unsent = entries.filter((e) => !e.sent && e.mutation.id === mutation.id);
  const last = unsent.at(-1);

  if (mutation.type === "item.create") return { put: [], remove: [], add: mutation };

  if (mutation.type === "item.patch") {
    if (last?.mutation.type === "item.create") {
      return {
        put: [{ ...last, mutation: foldIntoCreate(last.mutation, mutation.patch) }],
        remove: [],
        add: null,
      };
    }
    if (last?.mutation.type === "item.patch") {
      return {
        put: [
          {
            ...last,
            mutation: { ...last.mutation, patch: { ...last.mutation.patch, ...mutation.patch } },
          },
        ],
        remove: [],
        add: null,
      };
    }
    return { put: [], remove: [], add: mutation };
  }

  const created = unsent.some((e) => e.mutation.type === "item.create");
  return {
    put: [],
    remove: unsent.map((e) => e.seq),
    add: created ? null : mutation,
  };
}

export function enqueue(mutation: NewMutation): Promise<void> {
  return withDatabase((db) => {
    const transaction = db.transaction(QUEUE_STORE, "readwrite");
    const queue = transaction.objectStore(QUEUE_STORE);
    queue.getAll().onsuccess = (event) => {
      const entries = (event.target as IDBRequest<QueueEntry[]>).result;
      const plan = planEnqueue(entries, mutation);
      for (const seq of plan.remove) queue.delete(seq);
      for (const entry of plan.put) queue.put(entry);
      if (plan.add) queue.add({ sent: false, mutation: plan.add });
    };
    return committed(transaction);
  });
}

export function readQueue(): Promise<QueueEntry[]> {
  return withDatabase((db) =>
    requestResult<QueueEntry[]>(db.transaction(QUEUE_STORE).objectStore(QUEUE_STORE).getAll())
  );
}

export function markSent(seqs: number[]): Promise<void> {
  return withDatabase((db) => {
    const transaction = db.transaction(QUEUE_STORE, "readwrite");
    const queue = transaction.objectStore(QUEUE_STORE);
    for (const seq of seqs) {
      queue.get(seq).onsuccess = (event) => {
        const entry = (event.target as IDBRequest<QueueEntry | undefined>).result;
        if (entry) queue.put({ ...entry, sent: true });
      };
    }
    return committed(transaction);
  });
}

export function removeFromQueue(seqs: number[]): Promise<void> {
  return withDatabase((db) => {
    const transaction = db.transaction(QUEUE_STORE, "readwrite");
    for (const seq of seqs) transaction.objectStore(QUEUE_STORE).delete(seq);
    return committed(transaction);
  });
}

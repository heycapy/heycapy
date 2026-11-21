import type { PullTombstone } from "@/lib/sync/pull";
import type { PullPage, StoredRecord, WireRecord } from "./types";

export type Change = { puts: StoredRecord[]; deletes: string[] };

type Entity = WireRecord["entity"];

export const recordKey = (entity: Entity, id: string | number) => `${entity}:${id}`;

function toStored(record: WireRecord): StoredRecord {
  const key = recordKey(record.entity, record.id);
  switch (record.entity) {
    case "bucket":
      return { ...record, key, bucketId: record.id };
    case "bucket_member":
    case "item":
      return { ...record, key, bucketId: record.data.bucketId };
    case "item_reminder":
      return { ...record, key, bucketId: null };
  }
}

// The rules for turning a pull page into local changes. Deletes go first, then the rows, whatever
// their revisions: a join sends old rows that a later-numbered delete must not remove
export function applyPage(existing: StoredRecord[], page: PullPage, userId: number): Change {
  const working = new Map(existing.map((r) => [r.key, r]));
  const touched = new Set<string>();

  const remove = (key: string) => {
    working.delete(key);
    touched.add(key);
  };
  const removeItem = (itemId: string) => {
    remove(recordKey("item", itemId));
    remove(recordKey("item_reminder", itemId));
  };
  const removeBucket = (bucketId: number) => {
    for (const r of [...working.values()]) {
      if (r.bucketId !== bucketId) continue;
      if (r.entity === "item") removeItem(r.id);
      else remove(r.key);
    }
  };

  for (const t of page.tombstones) applyTombstone(t);
  for (const r of page.records) {
    const stored = toStored(r);
    working.set(stored.key, stored);
    touched.add(stored.key);
  }

  // A reminder lives and dies with its item on the device
  for (const r of [...working.values()]) {
    if (r.entity === "item_reminder" && !working.has(recordKey("item", r.id))) remove(r.key);
  }

  const puts: StoredRecord[] = [];
  const deletes: string[] = [];
  for (const key of touched) {
    const row = working.get(key);
    if (row) puts.push(row);
    else deletes.push(key);
  }
  return { puts, deletes };

  function applyTombstone(t: PullTombstone) {
    switch (t.entity) {
      case "item": {
        // A move leaves a tombstone for the old bucket, the item row may already be in the new one
        const item = working.get(recordKey("item", t.id));
        if (item && item.bucketId === t.bucketId) removeItem(t.id);
        return;
      }
      case "item_reminder":
        remove(recordKey("item_reminder", t.id));
        return;
      case "bucket":
        removeBucket(Number(t.id));
        return;
      case "bucket_member":
        if (t.userId === userId && t.bucketId !== null) removeBucket(t.bucketId);
        else remove(recordKey("bucket_member", t.id));
        return;
    }
  }
}

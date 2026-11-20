import type { ListItem, ReminderBadge } from "@/lib/reminders/status";
import { SNAPSHOT_DB, SNAPSHOT_STORE, SNAPSHOT_VERSION } from "./constants";

export type BucketSnapshot = {
  items: ListItem[];
  reminderBadges: Record<number, ReminderBadge>;
};

const bucketKey = (bucketId: number) => `bucket:${bucketId}`;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SNAPSHOT_DB, SNAPSHOT_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (db.objectStoreNames.contains(SNAPSHOT_STORE)) db.deleteObjectStore(SNAPSHOT_STORE);
      db.createObjectStore(SNAPSHOT_STORE);
    };
    request.onsuccess = () => {
      const db = request.result;
      // A pending deleteDatabase (logout) waits until every connection has closed
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("snapshot database is blocked"));
  });
}

async function inStore<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(SNAPSHOT_STORE, mode);
      const request = work(transaction.objectStore(SNAPSHOT_STORE));
      // A write counts once the transaction commits, not when its request succeeds
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

// The snapshot is an extra: storage can be off (private mode) or full, and the live path must not break
export async function saveBucketSnapshot(bucketId: number, snapshot: BucketSnapshot) {
  try {
    await inStore("readwrite", (store) => store.put(snapshot, bucketKey(bucketId)));
  } catch {}
}

export async function readBucketSnapshot(bucketId: number): Promise<BucketSnapshot | null> {
  try {
    const saved = await inStore<BucketSnapshot | undefined>("readonly", (store) =>
      store.get(bucketKey(bucketId))
    );
    return saved ?? null;
  } catch {
    return null;
  }
}

export function clearSnapshots(): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(SNAPSHOT_DB);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

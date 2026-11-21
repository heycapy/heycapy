import {
  META_CURSOR,
  META_SCHEMA,
  META_STORE,
  META_USER_ID,
  RECORDS_BY_BUCKET,
  RECORDS_STORE,
  SYNC_DB,
  SYNC_DB_VERSION,
} from "./constants";
import { applyPage } from "./apply";
import type { PullPage, StoredRecord } from "./types";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SYNC_DB, SYNC_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      const records = db.createObjectStore(RECORDS_STORE, { keyPath: "key" });
      records.createIndex(RECORDS_BY_BUCKET, "bucketId");
      db.createObjectStore(META_STORE);
    };
    request.onsuccess = () => {
      const db = request.result;
      // A pending deleteDatabase (logout) or a newer version waits until every connection has closed
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("sync database is blocked"));
  });
}

const requestResult = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

// A write counts once the transaction commits, not when its last request succeeds
const committed = (transaction: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });

export async function withDatabase<T>(work: (db: IDBDatabase) => Promise<T>): Promise<T> {
  const db = await openDatabase();
  try {
    return await work(db);
  } finally {
    db.close();
  }
}

export function readMeta<T>(key: string): Promise<T | undefined> {
  return withDatabase((db) =>
    requestResult<T | undefined>(db.transaction(META_STORE).objectStore(META_STORE).get(key))
  );
}

export function readRecords(): Promise<StoredRecord[]> {
  return withDatabase((db) =>
    requestResult<StoredRecord[]>(db.transaction(RECORDS_STORE).objectStore(RECORDS_STORE).getAll())
  );
}

// The page and the new cursor commit together: a crash between them would replay or skip changes
export function applyPullPage(page: PullPage, userId: number, schema: number): Promise<void> {
  return withDatabase((db) => {
    const transaction = db.transaction([RECORDS_STORE, META_STORE], "readwrite");
    const records = transaction.objectStore(RECORDS_STORE);
    const meta = transaction.objectStore(META_STORE);
    // Reading, deciding and writing in one transaction: nothing can change the rows in between
    records.getAll().onsuccess = (event) => {
      const existing = (event.target as IDBRequest<StoredRecord[]>).result;
      const { puts, deletes } = applyPage(existing, page, userId);
      for (const key of deletes) records.delete(key);
      for (const row of puts) records.put(row);
      meta.put(page.cursor, META_CURSOR);
      meta.put(schema, META_SCHEMA);
      meta.put(userId, META_USER_ID);
    };
    return committed(transaction);
  });
}

// A download from cursor 0: the cache goes, whatever the device has queued stays
export function resetRecords(): Promise<void> {
  return withDatabase((db) => {
    const transaction = db.transaction([RECORDS_STORE, META_STORE], "readwrite");
    transaction.objectStore(RECORDS_STORE).clear();
    transaction.objectStore(META_STORE).put(0, META_CURSOR);
    return committed(transaction);
  });
}

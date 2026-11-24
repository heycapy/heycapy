import { REJECTIONS_STORE } from "./constants";
import { committed, requestResult, withDatabase } from "./store";
import type { NewMutation, StoredRecord, StoredRejection } from "./types";

// The name of the item a refused change was about, so the message can say which one
export function rejectionTitle(records: StoredRecord[], mutation: NewMutation): string | null {
  if (mutation.type === "item.create") return mutation.title.trim() || null;
  const item = records.find((r) => r.entity === "item" && r.id === mutation.id);
  return item?.entity === "item" ? item.data.title : null;
}

export function rejectionMessage({ title, reason }: Pick<StoredRejection, "title" | "reason">) {
  return `couldn't save${title ? ` "${title}"` : ""}: ${reason}`;
}

// Marking and reading happen in one transaction, so of several tabs only one toasts each refusal
export function takeNewRejections(): Promise<StoredRejection[]> {
  return withDatabase(async (db) => {
    const transaction = db.transaction(REJECTIONS_STORE, "readwrite");
    const store = transaction.objectStore(REJECTIONS_STORE);
    let taken: StoredRejection[] = [];
    store.getAll().onsuccess = (event) => {
      taken = (event.target as IDBRequest<StoredRejection[]>).result.filter((r) => !r.notified);
      for (const rejection of taken) store.put({ ...rejection, notified: true });
    };
    await committed(transaction);
    return taken;
  });
}

export function readRejections(): Promise<StoredRejection[]> {
  return withDatabase((db) =>
    requestResult<StoredRejection[]>(
      db.transaction(REJECTIONS_STORE).objectStore(REJECTIONS_STORE).getAll()
    )
  );
}

export function dismissRejections(ids: number[]): Promise<void> {
  return withDatabase((db) => {
    const transaction = db.transaction(REJECTIONS_STORE, "readwrite");
    for (const id of ids) transaction.objectStore(REJECTIONS_STORE).delete(id);
    return committed(transaction);
  });
}

import {
  PULL_DEFAULT_LIMIT,
  PUSH_MAX_BYTES,
  PUSH_MAX_MUTATIONS,
  SYNC_PROTOCOL_HEADER,
  SYNC_PROTOCOL_VERSION,
} from "@/constants";
import type { PushResult } from "@/lib/sync/protocol";
import {
  META_CURSOR,
  META_DEVICE_ID,
  META_SCHEMA,
  META_STORE,
  META_USER_ID,
  QUEUE_STORE,
  RECORDS_STORE,
} from "./constants";
import { markSent, readQueue, removeFromQueue } from "./queue";
import { applyPullPage, committed, readMeta, resetRecords, withDatabase } from "./store";
import type { NewMutation, PullPage, QueueEntry } from "./types";

export type Transport = (path: string, init?: RequestInit) => Promise<Response>;

export type Rejection = { mutation: NewMutation; reason: string };

export type SyncOutcome =
  | { status: "ok"; rejected: Rejection[] }
  | { status: "retry"; rejected: Rejection[] }
  | { status: "upgrade"; rejected: Rejection[] }
  | { status: "signedOut"; rejected: Rejection[] };

type Failure = Exclude<SyncOutcome["status"], "ok">;

class Stop extends Error {
  constructor(readonly status: Failure) {
    super(status);
  }
}

export const browserTransport: Transport = (path, init) =>
  fetch(path, {
    ...init,
    // The proxy answers a call with no session by redirecting to /login: that is "signed out"
    redirect: "manual",
    headers: { ...init?.headers, [SYNC_PROTOCOL_HEADER]: String(SYNC_PROTOCOL_VERSION) },
  });

async function call(transport: Transport, path: string, init?: RequestInit) {
  let response: Response;
  try {
    response = await transport(path, init);
  } catch {
    throw new Stop("retry");
  }
  if (response.type === "opaqueredirect" || response.status === 401) throw new Stop("signedOut");
  if (response.status === 426) throw new Stop("upgrade");
  // Anything else unexpected keeps the queue and tries again later: a change is never dropped
  // because a call failed
  if (!response.ok) throw new Stop("retry");
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new Stop("retry");
  }
}

async function deviceId(): Promise<string> {
  const saved = await readMeta<string>(META_DEVICE_ID);
  if (saved) return saved;
  const made = crypto.randomUUID();
  await withDatabase((db) => {
    const transaction = db.transaction(META_STORE, "readwrite");
    transaction.objectStore(META_STORE).put(made, META_DEVICE_ID);
    return committed(transaction);
  });
  return made;
}

// A cache and a queue belong to one person: another account on this browser starts from nothing
async function ownedBy(userId: number) {
  const owner = await readMeta<number>(META_USER_ID);
  if (owner === undefined || owner === userId) return;
  await withDatabase((db) => {
    const transaction = db.transaction([RECORDS_STORE, META_STORE, QUEUE_STORE], "readwrite");
    transaction.objectStore(RECORDS_STORE).clear();
    transaction.objectStore(META_STORE).clear();
    transaction.objectStore(QUEUE_STORE).clear();
    return committed(transaction);
  });
}

function nextBatch(queue: QueueEntry[]): QueueEntry[] {
  const batch: QueueEntry[] = [];
  let bytes = 0;
  for (const entry of queue) {
    bytes += JSON.stringify(entry).length;
    if (batch.length > 0 && (batch.length >= PUSH_MAX_MUTATIONS || bytes > PUSH_MAX_BYTES / 2)) {
      break;
    }
    batch.push(entry);
  }
  return batch;
}

async function push(transport: Transport, rejected: Rejection[]) {
  const id = await deviceId();
  for (;;) {
    const batch = nextBatch(await readQueue());
    if (batch.length === 0) return;
    await markSent(batch.map((e) => e.seq));

    const body = await call(transport, "/api/v1/sync/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        deviceId: id,
        mutations: batch.map((e) => ({ ...e.mutation, seq: e.seq })),
      }),
    });
    const results = (body as { results?: PushResult[] }).results;
    if (!Array.isArray(results)) throw new Stop("retry");

    const bySeq = new Map(batch.map((e) => [e.seq, e]));
    const done: number[] = [];
    for (const r of results) {
      const entry = bySeq.get(r.seq);
      if (!entry) continue;
      done.push(r.seq);
      if (r.result === "rejected") rejected.push({ mutation: entry.mutation, reason: r.reason });
    }
    if (done.length === 0) throw new Stop("retry");
    await removeFromQueue(done);
  }
}

type PullBody = { reset: true } | (PullPage & { schema: number });

async function pull(transport: Transport, userId: number) {
  for (;;) {
    const cursor = (await readMeta<number>(META_CURSOR)) ?? 0;
    const body = (await call(
      transport,
      `/api/v1/sync/pull?cursor=${cursor}&limit=${PULL_DEFAULT_LIMIT}`
    )) as PullBody;

    if (body.reset) {
      // Never from a cursor of 0: the server only resets a cursor it can't serve
      await resetRecords();
      continue;
    }
    const saved = await readMeta<number>(META_SCHEMA);
    if (saved !== undefined && saved !== body.schema) {
      await resetRecords(body.schema);
      continue;
    }
    await applyPullPage(body, userId, body.schema);
    if (!body.more) return;
  }
}

// One round: send what is queued, then bring in what changed. Meant to run in one tab at a time
export async function syncOnce(transport: Transport, userId: number): Promise<SyncOutcome> {
  const rejected: Rejection[] = [];
  try {
    await ownedBy(userId);
    await push(transport, rejected);
    await pull(transport, userId);
    return { status: "ok", rejected };
  } catch (error) {
    if (error instanceof Stop) return { status: error.status, rejected };
    throw error;
  }
}

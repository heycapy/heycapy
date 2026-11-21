import {
  RETRY_BASE_MS,
  RETRY_MAX_MS,
  SYNC_CHANNEL,
  SYNC_LOCK,
  SYNC_NOW_TIMEOUT_MS,
} from "./constants";
import { syncOnce, type SyncOutcome, type Transport } from "./engine";

type Status = SyncOutcome["status"];
type Message =
  { type: "wake"; request?: string } | { type: "changed"; answered?: string[]; status?: Status };

export type SyncRuntimeOptions = {
  userId: number;
  transport: Transport;
  locks: Pick<LockManager, "request">;
  createChannel: (name: string) => Pick<BroadcastChannel, "postMessage" | "close"> & {
    onmessage: ((event: MessageEvent<Message>) => void) | null;
  };
  round?: typeof syncOnce;
  onOutcome?: (outcome: SyncOutcome) => void;
};

export const retryDelay = (failures: number) =>
  Math.min(RETRY_BASE_MS * 2 ** (failures - 1), RETRY_MAX_MS);

// One engine per browser: tabs queue for a lock, the one holding it syncs, and the others only
// ask it to (`wake`) and hear when the database changed (`changed`). Two engines would send the
// same queue twice
export function createSyncRuntime(options: SyncRuntimeOptions) {
  const { userId, transport, locks, createChannel, onOutcome } = options;
  const round = options.round ?? syncOnce;
  const channel = createChannel(SYNC_CHANNEL);
  const listeners = new Set<() => void>();
  const abort = new AbortController();

  let leading = false;
  let stopped = false;
  let wakeRequested = false;
  let wakeUp: (() => void) | null = null;
  // Asked in this tab, answered by the next round that starts after the ask
  let waiters: ((status: Status) => void)[] = [];
  // Asked by other tabs (their request ids), answered the same way
  let remote: string[] = [];
  // Asked here while another tab syncs, answered by its `changed` message
  const pending = new Map<string, (status: Status) => void>();

  const notify = () => listeners.forEach((listener) => listener());

  channel.onmessage = (event) => {
    const message = event.data;
    if (message.type === "wake") {
      if (message.request) remote.push(message.request);
      wake();
      return;
    }
    for (const id of message.answered ?? []) {
      pending.get(id)?.(message.status ?? "retry");
      pending.delete(id);
    }
    notify();
  };

  function wake() {
    wakeRequested = true;
    wakeUp?.();
  }

  // A wake that arrives during a round is kept, so a change made then is not left waiting
  function sleep(ms: number | null): Promise<void> {
    if (wakeRequested || stopped) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = ms === null ? null : setTimeout(done, ms);
      wakeUp = done;
      function done() {
        if (timer) clearTimeout(timer);
        wakeUp = null;
        resolve();
      }
    });
  }

  async function lead() {
    leading = true;
    let failures = 0;
    // Whoever asked before this tab became the one that syncs is answered by the first round
    for (const resolve of pending.values()) waiters.push(resolve);
    pending.clear();
    try {
      while (!stopped) {
        wakeRequested = false;
        const asked = { here: waiters, other: remote };
        waiters = [];
        remote = [];
        let outcome: SyncOutcome;
        try {
          outcome = await round(transport, userId);
        } catch (error) {
          asked.here.forEach((resolve) => resolve("retry"));
          throw error;
        }
        asked.here.forEach((resolve) => resolve(outcome.status));
        notify();
        channel.postMessage({ type: "changed", answered: asked.other, status: outcome.status });
        onOutcome?.(outcome);
        failures = outcome.status === "retry" ? failures + 1 : 0;
        // Nothing to retry after "upgrade" or "signedOut": wait for the next reason to look again
        await sleep(outcome.status === "retry" ? retryDelay(failures) : null);
      }
    } finally {
      leading = false;
    }
  }

  async function start() {
    try {
      await locks.request(SYNC_LOCK, { signal: abort.signal }, lead);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) throw error;
    }
  }

  return {
    start,
    // Ask for a round: now if this tab syncs, otherwise through the tab that does
    trigger() {
      if (stopped) return;
      if (leading) wake();
      else channel.postMessage({ type: "wake" });
    },
    // Ask for a round and wait for one that started after this call, so what was written to the
    // server just before is in the local data when it resolves
    syncNow(): Promise<Status> {
      if (stopped) return Promise.resolve("retry");
      return new Promise((resolve) => {
        if (leading) {
          waiters.push(resolve);
          wake();
          return;
        }
        const request = crypto.randomUUID();
        const timer = setTimeout(() => {
          pending.delete(request);
          resolve("retry");
        }, SYNC_NOW_TIMEOUT_MS);
        pending.set(request, (status) => {
          clearTimeout(timer);
          resolve(status);
        });
        channel.postMessage({ type: "wake", request });
      });
    },
    // Called with every change of the local database, from this tab or another
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    stop() {
      stopped = true;
      waiters.forEach((resolve) => resolve("retry"));
      pending.forEach((resolve) => resolve("retry"));
      abort.abort();
      wakeUp?.();
      channel.close();
    },
  };
}

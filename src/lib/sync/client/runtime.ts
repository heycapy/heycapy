import { RETRY_BASE_MS, RETRY_MAX_MS, SYNC_CHANNEL, SYNC_LOCK } from "./constants";
import { syncOnce, type SyncOutcome, type Transport } from "./engine";

type Message = { type: "wake" } | { type: "changed" };

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

  const notify = () => listeners.forEach((listener) => listener());

  channel.onmessage = (event) => {
    if (event.data.type === "wake") wake();
    else notify();
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
    try {
      while (!stopped) {
        wakeRequested = false;
        const outcome = await round(transport, userId);
        notify();
        channel.postMessage({ type: "changed" });
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
    // Called with every change of the local database, from this tab or another
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    stop() {
      stopped = true;
      abort.abort();
      wakeUp?.();
      channel.close();
    },
  };
}

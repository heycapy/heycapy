import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RETRY_BASE_MS, RETRY_MAX_MS } from "@/lib/sync/client/constants";
import type { SyncOutcome } from "@/lib/sync/client/engine";
import { createSyncRuntime, retryDelay } from "@/lib/sync/client/runtime";

const ok: SyncOutcome = { status: "ok", rejected: [] };
const retry: SyncOutcome = { status: "retry", rejected: [] };

// An exclusive lock with a queue, released when the callback's promise settles, like the browser's
function fakeLocks() {
  let held = false;
  const waiting: (() => void)[] = [];
  return {
    request: async (
      _name: string,
      options: { signal?: AbortSignal },
      callback: () => Promise<void>
    ) => {
      if (held) {
        await new Promise<void>((resolve, reject) => {
          waiting.push(resolve);
          options.signal?.addEventListener("abort", () => {
            waiting.splice(waiting.indexOf(resolve), 1);
            reject(new DOMException("aborted", "AbortError"));
          });
        });
      }
      held = true;
      try {
        await callback();
      } finally {
        held = false;
        waiting.shift()?.();
      }
    },
  } as unknown as Pick<LockManager, "request">;
}

// Every channel of one name hears the others, never itself
function fakeChannels() {
  const open = new Set<{ onmessage: ((e: MessageEvent) => void) | null }>();
  return (_name: string) => {
    const channel = {
      onmessage: null as ((e: MessageEvent) => void) | null,
      postMessage(data: unknown) {
        for (const other of open) {
          if (other !== channel) other.onmessage?.({ data } as MessageEvent);
        }
      },
      close() {
        open.delete(channel);
      },
    };
    open.add(channel);
    return channel;
  };
}

function setup(rounds: SyncOutcome[] = []) {
  const locks = fakeLocks();
  const createChannel = fakeChannels();
  const log: string[] = [];
  const make = (name: string, answers: SyncOutcome[] = rounds) => {
    let i = 0;
    return createSyncRuntime({
      userId: 1,
      transport: vi.fn(),
      locks,
      createChannel,
      round: async () => {
        log.push(name);
        return answers[Math.min(i++, answers.length - 1)] ?? ok;
      },
    });
  };
  return { make, log };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("retryDelay", () => {
  it("doubles from the base up to the cap", () => {
    expect([1, 2, 3].map(retryDelay)).toEqual([
      RETRY_BASE_MS,
      RETRY_BASE_MS * 2,
      RETRY_BASE_MS * 4,
    ]);
    expect(retryDelay(40)).toBe(RETRY_MAX_MS);
  });
});

describe("the sync runtime", () => {
  it("only the tab holding the lock syncs", async () => {
    const { make, log } = setup();
    const a = make("a");
    const b = make("b");
    void a.start();
    void b.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(log).toEqual(["a"]);
    a.stop();
    b.stop();
  });

  it("the next tab takes over when the leader closes", async () => {
    const { make, log } = setup();
    const a = make("a");
    const b = make("b");
    void a.start();
    void b.start();
    await vi.advanceTimersByTimeAsync(0);
    a.stop();
    await vi.advanceTimersByTimeAsync(0);
    expect(log).toEqual(["a", "b"]);
    b.stop();
  });

  it("a tab that is not the leader asks the leader for a round", async () => {
    const { make, log } = setup();
    const a = make("a");
    const b = make("b");
    void a.start();
    void b.start();
    await vi.advanceTimersByTimeAsync(0);
    b.trigger();
    await vi.advanceTimersByTimeAsync(0);
    expect(log).toEqual(["a", "a"]);
    a.stop();
    b.stop();
  });

  it("tells every tab when the local data may have changed", async () => {
    const { make } = setup();
    const a = make("a");
    const b = make("b");
    const heardByA = vi.fn();
    const heardByB = vi.fn();
    a.subscribe(heardByA);
    b.subscribe(heardByB);
    void a.start();
    void b.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(heardByA).toHaveBeenCalledTimes(1);
    expect(heardByB).toHaveBeenCalledTimes(1);
    a.stop();
    b.stop();
  });

  it("a wake during a round is not lost", async () => {
    const locks = fakeLocks();
    let release: () => void = () => {};
    let rounds = 0;
    const runtime = createSyncRuntime({
      userId: 1,
      transport: vi.fn(),
      locks,
      createChannel: fakeChannels(),
      round: async () => {
        rounds++;
        if (rounds === 1) await new Promise<void>((resolve) => (release = resolve));
        return ok;
      },
    });
    void runtime.start();
    await vi.advanceTimersByTimeAsync(0);
    runtime.trigger();
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(rounds).toBe(2);
    runtime.stop();
  });

  it("waits longer after each failure, and a wake tries again at once", async () => {
    const { make, log } = setup([retry, retry, ok]);
    const a = make("a");
    void a.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(log).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(RETRY_BASE_MS - 1);
    expect(log).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(log).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(RETRY_BASE_MS * 2 - 1);
    expect(log).toHaveLength(2);
    a.trigger();
    await vi.advanceTimersByTimeAsync(0);
    expect(log).toHaveLength(3);
    a.stop();
  });

  it("does not retry on its own after an upgrade or a sign-out", async () => {
    const { make, log } = setup([{ status: "upgrade", rejected: [] }]);
    const a = make("a");
    void a.start();
    await vi.advanceTimersByTimeAsync(RETRY_MAX_MS * 2);
    expect(log).toEqual(["a"]);
    a.stop();
  });

  it("stops asking for the lock when it is stopped before it gets it", async () => {
    const { make, log } = setup();
    const a = make("a");
    const b = make("b");
    void a.start();
    const waiting = b.start();
    await vi.advanceTimersByTimeAsync(0);
    b.stop();
    await expect(waiting).resolves.toBeUndefined();
    a.stop();
    await vi.advanceTimersByTimeAsync(0);
    expect(log).toEqual(["a"]);
  });

  it("a stopped runtime ignores a trigger", async () => {
    const { make } = setup();
    const a = make("a");
    void a.start();
    await vi.advanceTimersByTimeAsync(0);
    a.stop();
    expect(() => a.trigger()).not.toThrow();
  });
});

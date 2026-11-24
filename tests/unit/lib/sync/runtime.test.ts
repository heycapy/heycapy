import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RETRY_BASE_MS,
  RETRY_MAX_MS,
  SYNC_NOW_TIMEOUT_MS,
  SYNC_STALL_MS,
} from "@/lib/sync/client/constants";
import type { SyncOutcome } from "@/lib/sync/client/engine";
import { createSyncRuntime, retryDelay } from "@/lib/sync/client/runtime";

const ok: SyncOutcome = { status: "ok", rejected: [] };
const retry: SyncOutcome = { status: "retry", rejected: [] };

// An exclusive lock with a queue, released when the callback's promise settles, like the browser's.
// `steal` takes it at once and the old holder keeps running, which is what the browser does
function fakeLocks() {
  let holder = 0;
  let held = false;
  const waiting: (() => void)[] = [];
  return {
    request: async (
      _name: string,
      options: { signal?: AbortSignal; steal?: boolean },
      callback: () => Promise<void>
    ) => {
      if (held && !options.steal) {
        await new Promise<void>((resolve, reject) => {
          waiting.push(resolve);
          options.signal?.addEventListener("abort", () => {
            waiting.splice(waiting.indexOf(resolve), 1);
            reject(new DOMException("aborted", "AbortError"));
          });
        });
      }
      held = true;
      const mine = ++holder;
      try {
        await callback();
      } finally {
        if (mine === holder) {
          held = false;
          waiting.shift()?.();
        }
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

describe("syncNow", () => {
  // A round that waits until the test lets it finish
  function gated(statuses: SyncOutcome["status"][]) {
    const locks = fakeLocks();
    const createChannel = fakeChannels();
    const gates: (() => void)[] = [];
    const started: number[] = [];
    const make = () => {
      let n = 0;
      return createSyncRuntime({
        userId: 1,
        transport: vi.fn(),
        locks,
        createChannel,
        round: async () => {
          const index = n++;
          started.push(index);
          await new Promise<void>((resolve) => gates.push(resolve));
          return { status: statuses[Math.min(index, statuses.length - 1)], rejected: [] };
        },
      });
    };
    const finish = async () => {
      gates.shift()?.();
      await vi.advanceTimersByTimeAsync(0);
    };
    return { make, finish, started };
  }

  it("resolves with the status of a round that started after the call", async () => {
    const { make, finish, started } = gated(["ok", "retry"]);
    const a = make();
    void a.start();
    await vi.advanceTimersByTimeAsync(0);
    // The first round is already running: it may have read before what was just written
    const answered = vi.fn();
    void a.syncNow().then(answered);
    await finish();
    expect(answered).not.toHaveBeenCalled();
    await finish();
    expect(started).toEqual([0, 1]);
    expect(answered).toHaveBeenCalledWith("retry");
    a.stop();
  });

  it("a tab that does not sync gets the answer from the one that does", async () => {
    const { make, finish } = gated(["ok", "ok"]);
    const a = make();
    const b = make();
    void a.start();
    void b.start();
    await vi.advanceTimersByTimeAsync(0);
    await finish();
    const answered = vi.fn();
    void b.syncNow().then(answered);
    await vi.advanceTimersByTimeAsync(0);
    expect(answered).not.toHaveBeenCalled();
    await finish();
    expect(answered).toHaveBeenCalledWith("ok");
    a.stop();
    b.stop();
  });

  it("a tab that is asked mid-round is answered by the following round", async () => {
    const { make, finish } = gated(["ok", "ok", "ok"]);
    const a = make();
    const b = make();
    void a.start();
    void b.start();
    await vi.advanceTimersByTimeAsync(0);
    const answered = vi.fn();
    void b.syncNow().then(answered);
    await finish();
    expect(answered).not.toHaveBeenCalled();
    await finish();
    expect(answered).toHaveBeenCalledTimes(1);
    a.stop();
    b.stop();
  });

  it("gives up when nobody answers", async () => {
    const lonely = createSyncRuntime({
      userId: 1,
      transport: vi.fn(),
      locks: {
        request: () => new Promise<void>(() => {}),
      } as unknown as Pick<LockManager, "request">,
      createChannel: fakeChannels(),
      round: async () => ok,
    });
    const answered = vi.fn();
    void lonely.syncNow().then(answered);
    await vi.advanceTimersByTimeAsync(SYNC_NOW_TIMEOUT_MS);
    expect(answered).toHaveBeenCalledWith("retry");
    lonely.stop();
  });

  it("a request made before this tab became the leader is answered by its first round", async () => {
    const { make, finish } = gated(["ok"]);
    const a = make();
    const answered = vi.fn();
    void a.syncNow().then(answered);
    void a.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(answered).not.toHaveBeenCalled();
    await finish();
    expect(answered).toHaveBeenCalledWith("ok");
    a.stop();
  });

  it("resolves a waiting call when the runtime is stopped", async () => {
    const { make } = gated(["ok"]);
    const a = make();
    const b = make();
    void a.start();
    void b.start();
    await vi.advanceTimersByTimeAsync(0);
    const answered = vi.fn();
    void b.syncNow().then(answered);
    b.stop();
    await vi.advanceTimersByTimeAsync(0);
    expect(answered).toHaveBeenCalledWith("retry");
    a.stop();
  });
});

describe("queued", () => {
  it("shows the change in every tab and has the engine send it", async () => {
    const { make, log } = setup();
    const a = make("a");
    const b = make("b");
    const heardByA = vi.fn();
    const heardByB = vi.fn();
    a.subscribe(heardByA);
    b.subscribe(heardByB);
    void a.start();
    void b.start();
    await vi.advanceTimersByTimeAsync(0);
    heardByA.mockClear();
    heardByB.mockClear();

    b.queued();
    expect(heardByB).toHaveBeenCalledTimes(1);
    expect(heardByA).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(log).toEqual(["a", "a"]);
    a.stop();
    b.stop();
  });

  it("does nothing once stopped", async () => {
    const { make } = setup();
    const a = make("a");
    void a.start();
    await vi.advanceTimersByTimeAsync(0);
    const heard = vi.fn();
    a.subscribe(heard);
    a.stop();
    a.queued();
    expect(heard).not.toHaveBeenCalled();
  });

  describe("a leader that stops answering", () => {
    function hungLeader() {
      const locks = fakeLocks();
      const createChannel = fakeChannels();
      const log: string[] = [];
      let release: () => void = () => {};
      const hung = new Promise<SyncOutcome>((resolve) => {
        release = () => resolve(ok);
      });
      const base = { userId: 1, transport: vi.fn(), locks, createChannel };
      const leader = createSyncRuntime({
        ...base,
        round: async () => {
          log.push("leader");
          return hung;
        },
      });
      const waiter = createSyncRuntime({
        ...base,
        round: async () => {
          log.push("waiter");
          return ok;
        },
      });
      return { leader, waiter, log, release };
    }

    it("another tab takes the lock over after the stall time and sends", async () => {
      const { leader, waiter, log } = hungLeader();
      void leader.start();
      await vi.advanceTimersByTimeAsync(0);
      void waiter.start();
      waiter.trigger();
      await vi.advanceTimersByTimeAsync(SYNC_STALL_MS - 1);
      expect(log).toEqual(["leader"]);
      await vi.advanceTimersByTimeAsync(1);
      expect(log).toEqual(["leader", "waiter"]);
      leader.stop();
      waiter.stop();
    });

    it("the old leader stops syncing once it comes back, and the new one keeps the lock", async () => {
      const { leader, waiter, log, release } = hungLeader();
      void leader.start();
      await vi.advanceTimersByTimeAsync(0);
      void waiter.start();
      waiter.trigger();
      await vi.advanceTimersByTimeAsync(SYNC_STALL_MS);
      release();
      await vi.advanceTimersByTimeAsync(0);
      leader.trigger();
      await vi.advanceTimersByTimeAsync(0);
      expect(log).toEqual(["leader", "waiter", "waiter"]);
      leader.stop();
      waiter.stop();
    });

    it("a leader that answers is left alone", async () => {
      const { make, log } = setup();
      const a = make("a");
      const b = make("b");
      void a.start();
      void b.start();
      await vi.advanceTimersByTimeAsync(0);
      b.trigger();
      await vi.advanceTimersByTimeAsync(SYNC_STALL_MS * 2);
      expect(log).toEqual(["a", "a"]);
      a.stop();
      b.stop();
    });
  });
});

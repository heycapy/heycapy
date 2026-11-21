import { useEffect, useRef } from "react";
import { useUIStore } from "@/store/ui";
import { browserTransport } from "@/lib/sync/client/engine";
import { createSyncRuntime } from "@/lib/sync/client/runtime";

type Runtime = ReturnType<typeof createSyncRuntime>;

let current: Runtime | null = null;

// For whatever changes the local data: ask for a round now
export function requestSync() {
  current?.trigger();
}

const supported = () =>
  typeof indexedDB !== "undefined" &&
  "locks" in navigator &&
  typeof BroadcastChannel !== "undefined";

export function useSync(userId: number) {
  const refreshTick = useUIStore((s) => s.refreshTick);
  const seenTick = useRef(refreshTick);

  useEffect(() => {
    // A browser without these keeps working as an online-only app
    if (!supported()) return;
    const runtime = createSyncRuntime({
      userId,
      transport: browserTransport,
      locks: navigator.locks,
      createChannel: (name) => new BroadcastChannel(name),
    });
    current = runtime;
    runtime.start().catch(() => {});

    const wake = () => runtime.trigger();
    const resume = () => {
      if (document.visibilityState === "visible") wake();
    };
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", resume);
    return () => {
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", resume);
      runtime.stop();
      if (current === runtime) current = null;
    };
  }, [userId]);

  // The live-updates stream ticks this when something changed on the server
  useEffect(() => {
    if (seenTick.current === refreshTick) return;
    seenTick.current = refreshTick;
    requestSync();
  }, [refreshTick]);
}

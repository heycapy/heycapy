import { useEffect, useRef } from "react";
import { useUIStore } from "@/store/ui";
import { browserTransport } from "@/lib/sync/client/engine";
import { cancelUnsentDelete, enqueue } from "@/lib/sync/client/queue";
import { keepStorage } from "@/lib/sync/client/persist";
import { createSyncRuntime } from "@/lib/sync/client/runtime";
import type { NewMutation } from "@/lib/sync/client/types";

type Runtime = ReturnType<typeof createSyncRuntime>;

let current: Runtime | null = null;
const changeListeners = new Set<() => void>();

// Whenever the local data may have changed, from a round here or in another tab. A reader can
// subscribe before the runtime exists, effects run children first
export function subscribeToChanges(listener: () => void) {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
}

// A change the person made: kept on the device, shown at once, sent when the server can be reached
export async function queueMutation(mutation: NewMutation) {
  await enqueue(mutation);
  current?.queued();
  void keepStorage();
}

export function announceChange() {
  current?.changed();
}

export async function undoQueuedDelete(itemId: string) {
  const cancelled = await cancelUnsentDelete(itemId);
  if (cancelled) current?.queued();
  return cancelled;
}

// Ask for a round and wait until one that started after this call has finished
export async function syncNow() {
  return (await current?.syncNow()) ?? "retry";
}

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
      // The calls that run on their own are what tell whether the server can be reached
      onOutcome: ({ status }) => {
        if (status === "upgrade") useUIStore.getState().setSyncOutdated(true);
        if (status === "ok" || status === "retry")
          useUIStore.getState().setOffline(status === "retry");
      },
    });
    current = runtime;
    const unsubscribe = runtime.subscribe(() => changeListeners.forEach((l) => l()));
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
      unsubscribe();
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

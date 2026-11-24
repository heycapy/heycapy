import { useEffect, useState } from "react";
import { readQueue } from "@/lib/sync/client/queue";
import { subscribeToChanges } from "./useSync";

type Unsent = { count: number; itemIds: ReadonlySet<string> };

const NONE: Unsent = { count: 0, itemIds: new Set() };

// The changes made here that have not reached the server, kept up to date while `enabled`
export function useUnsentChanges(enabled: boolean): Unsent {
  const [unsent, setUnsent] = useState(NONE);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const read = () => {
      void readQueue()
        .then((queue) => {
          if (cancelled) return;
          setUnsent({ count: queue.length, itemIds: new Set(queue.map((e) => e.mutation.id)) });
        })
        .catch(() => {});
    };
    read();
    const unsubscribe = subscribeToChanges(read);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [enabled]);
  return unsent;
}

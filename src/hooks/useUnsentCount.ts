import { useEffect, useState } from "react";
import { readQueue } from "@/lib/sync/client/queue";

// How many changes made here have not reached the server, read while `enabled`
export function useUnsentCount(enabled: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void readQueue()
      .then((queue) => {
        if (!cancelled) setCount(queue.length);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return count;
}

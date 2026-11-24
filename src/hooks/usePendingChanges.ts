import { useEffect, useState } from "react";
import { readQueue } from "@/lib/sync/client/queue";
import { subscribeToChanges } from "./useSync";

export function usePendingChanges() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let stopped = false;
    const read = () => {
      void readQueue()
        .then((queue) => {
          if (!stopped) setCount(queue.length);
        })
        .catch(() => {});
    };
    read();
    const unsubscribe = subscribeToChanges(read);
    return () => {
      stopped = true;
      unsubscribe();
    };
  }, []);

  return count;
}

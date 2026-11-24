import { useEffect, useState } from "react";
import { notify } from "@/components/ui/notify";
import {
  dismissRejections,
  readRejections,
  rejectionMessage,
  takeNewRejections,
} from "@/lib/sync/client/rejections";
import type { StoredRejection } from "@/lib/sync/client/types";
import { announceChange, subscribeToChanges } from "./useSync";

// Tells the person once about changes the server refused. Only the tab in front does, so a
// refusal is not lost in a background tab, and each is toasted once even with several tabs open.
// The refusal itself stays (see `useRefusedChanges`) until it is dismissed
export function useRejections() {
  useEffect(() => {
    let stopped = false;
    const show = () => {
      if (document.visibilityState !== "visible") return;
      void takeNewRejections()
        .then((taken) => {
          if (!stopped) for (const r of taken) notify.error(rejectionMessage(r));
        })
        .catch(() => {});
    };
    show();
    const unsubscribe = subscribeToChanges(show);
    document.addEventListener("visibilitychange", show);
    return () => {
      stopped = true;
      unsubscribe();
      document.removeEventListener("visibilitychange", show);
    };
  }, []);
}

export function useRefusedChanges() {
  const [refused, setRefused] = useState<StoredRejection[]>([]);

  useEffect(() => {
    let stopped = false;
    const read = () => {
      void readRejections()
        .then((all) => {
          if (!stopped) setRefused(all);
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

  async function dismiss(ids: number[]) {
    await dismissRejections(ids);
    announceChange();
  }

  return { refused, dismiss };
}

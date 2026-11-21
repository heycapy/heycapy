import { useEffect } from "react";
import { notify } from "@/components/ui/notify";
import { rejectionMessage, takeRejections } from "@/lib/sync/client/rejections";
import { subscribeToChanges } from "./useSync";

// Tells the person about changes the server refused. Only the tab in front does, so a refusal
// is not lost in a background tab, and each is taken once even with several tabs open
export function useRejections() {
  useEffect(() => {
    let stopped = false;
    const show = () => {
      if (document.visibilityState !== "visible") return;
      void takeRejections()
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

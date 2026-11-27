import { useEffect, useState } from "react";
import { SYNC_NOTICE_DELAY_MS } from "@/lib/sync/client/constants";
import { useSyncNoticeStore } from "@/store/syncNotice";
import { useUIStore } from "@/store/ui";
import { useUnsentChanges } from "./useUnsentChanges";

// Decides when the person is told about syncing: at once when the server can't be reached, and
// when a change has waited a while, so a normal save (well under a second) never flashes anything.
// The header chip and the marks on rows both read the result from the store
export function useSyncNotice() {
  const offline = useUIStore((s) => s.offline);
  const { count, itemIds } = useUnsentChanges(true);
  const [waitedLong, setWaitedLong] = useState(false);
  const waiting = count > 0;

  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => setWaitedLong(true), SYNC_NOTICE_DELAY_MS);
    return () => {
      clearTimeout(timer);
      setWaitedLong(false);
    };
  }, [waiting]);

  const kind = offline ? "offline" : waitedLong && waiting ? "unsent" : null;

  useEffect(() => {
    useSyncNoticeStore.getState().setNotice(kind ? { kind, count, itemIds } : null);
  }, [kind, count, itemIds]);
}

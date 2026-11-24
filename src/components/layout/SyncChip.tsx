import { useState } from "react";
import { TextButton } from "@/components/ui/TextButton";
import { useRefusedChanges } from "@/hooks/useRejections";
import { syncNow } from "@/hooks/useSync";
import { useSyncNoticeStore } from "@/store/syncNotice";
import { cn } from "@/lib/utils";
import { RefusedDialog } from "./RefusedDialog";

type State = "refused" | "offline" | "unsent" | "syncing";

const DOT: Record<State, string> = {
  refused: "bg-destructive",
  offline: "bg-destructive",
  unsent: "bg-warning",
  syncing: "bg-warning",
};

// Only there when the person needs to know something: a refused change, no connection, or a
// change that has been waiting a while. Tapping it opens the refused list, or tries to sync
export function SyncChip() {
  const notice = useSyncNoticeStore((s) => s.notice);
  const { refused, dismiss } = useRefusedChanges();
  const [syncing, setSyncing] = useState(false);
  const [listOpen, setListOpen] = useState(false);

  const unsent = notice?.count ?? 0;
  const state: State | null =
    refused.length > 0 ? "refused" : syncing ? "syncing" : (notice?.kind ?? null);
  if (!state) return null;

  const count = unsent === 1 ? "1 change" : `${unsent} changes`;
  const label = {
    refused: `${refused.length} not saved`,
    syncing: "syncing...",
    offline: unsent > 0 ? `offline · ${unsent}` : "offline",
    unsent: `${unsent} unsent`,
  }[state];
  const description = {
    refused: `${refused.length === 1 ? "1 change was" : `${refused.length} changes were`} refused by the server. tap to see why`,
    syncing: "syncing",
    offline: `can't reach heycapy. ${
      unsent > 0
        ? `${count} saved on this device, sent when it's back.`
        : "what's on screen may be out of date."
    } tap to try again`,
    unsent: `${count} saved on this device, not sent yet. tap to sync now`,
  }[state];

  async function sync() {
    setSyncing(true);
    try {
      await syncNow();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
      <TextButton
        variant="ghost"
        onClick={state === "refused" ? () => setListOpen(true) : sync}
        disabled={state === "syncing"}
        aria-label={`sync: ${description}`}
        title={description}
      >
        <span
          aria-hidden
          className={cn("mr-1.5 size-1.5 shrink-0 rounded-(--dot-radius)", DOT[state])}
        />
        {label}
      </TextButton>
      {listOpen && refused.length > 0 && (
        <RefusedDialog
          refused={refused}
          onDismiss={(ids) => void dismiss(ids)}
          onClose={() => setListOpen(false)}
        />
      )}
    </>
  );
}

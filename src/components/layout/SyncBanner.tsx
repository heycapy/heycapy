import { useState } from "react";
import { TextButton } from "@/components/ui/TextButton";
import { syncNow } from "@/hooks/useSync";

const plural = (count: number) => `${count} ${count === 1 ? "change" : "changes"}`;

export function SyncBanner({ offline, pending }: { offline: boolean; pending: number }) {
  const [sending, setSending] = useState(false);

  async function send() {
    setSending(true);
    try {
      await syncNow();
    } finally {
      setSending(false);
    }
  }

  const message = offline
    ? pending > 0
      ? `can't reach heycapy. ${plural(pending)} saved on this device, sent when it's back.`
      : "can't reach heycapy. what's on screen may be out of date."
    : `${plural(pending)} saved on this device, not sent yet.`;

  return (
    <div className="px-4 pt-3">
      <div
        role="status"
        className="rounded-control border-border text-muted-foreground font-ui border-rule flex flex-wrap items-center gap-x-3 gap-y-1 border px-3 py-2 text-xs"
      >
        <span className="min-w-64 flex-1">{message}</span>
        <TextButton onClick={send} disabled={sending} className="shrink-0">
          {sending ? "sending..." : offline ? "try again" : "sync now"}
        </TextButton>
      </div>
    </div>
  );
}

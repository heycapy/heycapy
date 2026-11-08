import { useState } from "react";
import { TextButton } from "@/components/ui/TextButton";

export function NewVersionBanner() {
  const [refreshing, setRefreshing] = useState(false);

  function refresh() {
    setRefreshing(true);
    window.location.reload();
  }

  return (
    <div className="px-4 pt-3">
      <div
        role="status"
        className="rounded-control border-border text-muted-foreground font-ui border-rule flex flex-wrap items-center gap-x-3 gap-y-1 border px-3 py-2 text-xs"
      >
        <span className="min-w-64 flex-1">a new version of heycapy is out</span>
        <TextButton onClick={refresh} disabled={refreshing} className="shrink-0">
          {refreshing ? "refreshing..." : "refresh"}
        </TextButton>
      </div>
    </div>
  );
}

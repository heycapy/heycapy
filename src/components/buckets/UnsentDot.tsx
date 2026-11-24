import { Tooltip } from "@/components/ui/Tooltip";
import { useSyncNoticeStore } from "@/store/syncNotice";

// A row whose change is still on this device; only drawn while the sync notice is up
export function UnsentDot({ itemId }: { itemId: string }) {
  const unsent = useSyncNoticeStore((s) => s.notice?.itemIds.has(itemId) ?? false);
  if (!unsent) return null;
  return (
    <Tooltip text="not sent yet" className="shrink-0">
      <span role="img" aria-label="not sent yet" className="flex items-center pl-2">
        <span className="bg-warning size-1.5 rounded-(--dot-radius)" />
      </span>
    </Tooltip>
  );
}

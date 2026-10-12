import { BracketButton } from "@/components/ui/BracketButton";

export function NewVersionBanner() {
  return (
    <div className="px-4 pt-3">
      <div
        role="status"
        className="border-border text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 border border-dashed px-3 py-2 font-mono text-xs"
      >
        <span className="min-w-64 flex-1">a new version of heycapy is out</span>
        <BracketButton onClick={() => window.location.reload()} className="shrink-0">
          refresh
        </BracketButton>
      </div>
    </div>
  );
}

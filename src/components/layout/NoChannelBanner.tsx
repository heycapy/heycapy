import { BracketButton } from "@/components/ui/BracketButton";

export function NoChannelBanner({ onSetUp }: { onSetUp: () => void }) {
  return (
    <div className="px-4 pt-3">
      <div
        role="alert"
        className="border-border text-warning flex items-center gap-3 border border-dashed px-3 py-2 font-mono text-xs"
      >
        <span className="min-w-0 flex-1">
          ⚠ no notification channel works — you won&apos;t get any reminders
        </span>
        <BracketButton onClick={onSetUp} className="shrink-0">
          set up
        </BracketButton>
      </div>
    </div>
  );
}

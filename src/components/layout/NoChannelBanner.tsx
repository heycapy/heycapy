import { TextButton } from "@/components/ui/TextButton";

export function NoChannelBanner({ onSetUp }: { onSetUp: () => void }) {
  return (
    <div className="px-4 pt-3">
      <div
        role="alert"
        className="rounded-control border-border text-warning font-ui border-rule flex items-center gap-3 border px-3 py-2 text-xs"
      >
        <span className="min-w-0 flex-1">
          ⚠ no notification channel works — you won&apos;t get any reminders
        </span>
        <TextButton onClick={onSetUp} className="shrink-0">
          set up
        </TextButton>
      </div>
    </div>
  );
}

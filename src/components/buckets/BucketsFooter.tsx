import type { CSSProperties, Ref, RefObject } from "react";
import { TextButton } from "@/components/ui/TextButton";
import { useAssistantName } from "@/components/capy/assistant-name";
import { useLayoutStore } from "@/store/layout";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
import { cn } from "@/lib/utils";
import { useLookParts } from "@/components/looks/LookProvider";
import type { ViewerBucket } from "@/lib/buckets/access";
import { QuickAdd } from "./QuickAdd";

type BucketsFooterProps = {
  // null on today, which has nowhere to add to
  bucket: ViewerBucket | null;
  color: string;
  canAdd: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  panelSlotRef: Ref<HTMLDivElement>;
  onAdded: () => void;
  onExpand: () => void;
};

export function BucketsFooter({
  bucket,
  color,
  canAdd,
  inputRef,
  panelSlotRef,
  onAdded,
  onExpand,
}: BucketsFooterProps) {
  const setChatState = useLayoutStore((s) => s.setChatState);
  const chatOpen = useLayoutStore((s) => s.chatState !== "closed");
  const assistantName = useAssistantName();
  const keyboardInset = useKeyboardInset();
  const floating = useLookParts().footer === "floating";

  return (
    <div
      style={{ "--accent": color, "--keyboard-inset": `${keyboardInset}px` } as CSSProperties}
      className={cn(
        "bg-background sticky bottom-(--keyboard-inset) z-20",
        floating
          ? "px-2.5 pt-1 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4"
          : "border-border border-t-frame pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:pb-[env(safe-area-inset-bottom)]"
      )}
    >
      <div
        className={cn(
          "relative mx-auto flex w-full items-center gap-2 px-2.5 sm:px-4",
          !floating && "max-w-column",
          floating &&
            "border-border rounded-panel border-frame shadow-raised bg-background max-w-[calc(var(--container-column)-2rem)] transition-colors focus-within:border-(--accent)"
        )}
      >
        {!bucket ? (
          <p className="text-muted-foreground font-ui min-w-0 flex-1 pl-1 text-xs">
            open a bucket to add to it
          </p>
        ) : canAdd ? (
          <QuickAdd
            key={bucket.id}
            bucket={bucket}
            inputRef={inputRef}
            onAdded={onAdded}
            onExpand={onExpand}
          />
        ) : (
          <span className="flex-1" />
        )}
        <TextButton
          variant="ghost"
          onClick={() => setChatState(chatOpen ? "closed" : "open")}
          aria-label="chat with capy"
          aria-expanded={chatOpen}
          className={cn("bar-button max-w-32 shrink-0", chatOpen && "text-foreground")}
        >
          <span className="truncate">{assistantName}</span>
        </TextButton>
        <div
          ref={panelSlotRef}
          className={cn(
            "absolute",
            floating
              ? "-inset-x-(--frame-width) -bottom-(--frame-width)"
              : "inset-x-0 bottom-0 sm:inset-x-4"
          )}
        />
      </div>
    </div>
  );
}

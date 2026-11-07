import type { CSSProperties, Ref, RefObject } from "react";
import { TextButton } from "@/components/ui/TextButton";
import { useAssistantName } from "@/components/capy/assistant-name";
import { useLayoutStore } from "@/store/layout";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
import { cn } from "@/lib/utils";
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

  return (
    <div
      style={{ "--accent": color, "--keyboard-inset": `${keyboardInset}px` } as CSSProperties}
      className="border-border bg-background border-t-frame sticky bottom-(--keyboard-inset) z-20 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:pb-[env(safe-area-inset-bottom)]"
    >
      <div className="max-w-column relative mx-auto flex w-full items-center gap-2 px-2.5 sm:px-4">
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
          className={cn("h-12 max-w-32 shrink-0 px-1", chatOpen && "text-foreground")}
        >
          <span className="truncate">{assistantName}</span>
        </TextButton>
        <div ref={panelSlotRef} className="absolute inset-x-0 bottom-0 sm:inset-x-4" />
      </div>
    </div>
  );
}

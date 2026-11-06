import type { CSSProperties, Ref, RefObject } from "react";
import { BracketButton } from "@/components/ui/BracketButton";
import { useAssistantName } from "@/components/capy/assistant-name";
import { useLayoutStore } from "@/store/layout";
import { cn } from "@/lib/utils";
import type { ViewerBucket } from "@/lib/buckets/access";
import { QuickAdd } from "./QuickAdd";

type BucketsFooterProps = {
  // null on today, which has nowhere to add to
  bucket: ViewerBucket | null;
  color: string;
  canAdd: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  // where the full form grows up from on a wider screen
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

  return (
    // the footer is the add box: no frame of its own. Phones keep room below for the screen's
    // rounded corners
    <div
      style={{ "--accent": color } as CSSProperties}
      className="border-border bg-background sticky bottom-0 z-20 border-t-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:pb-[env(safe-area-inset-bottom)]"
    >
      <div className="max-w-column relative mx-auto flex w-full items-center gap-2 px-2.5 sm:px-4">
        {!bucket ? (
          <p className="text-muted-foreground min-w-0 flex-1 pl-1 font-mono text-xs">
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
        <BracketButton
          onClick={() => setChatState(chatOpen ? "closed" : "open")}
          aria-label="chat with capy"
          aria-expanded={chatOpen}
          className={cn("h-12 max-w-32 shrink-0 px-1", chatOpen && "text-foreground")}
        >
          <span className="truncate">{assistantName}</span>
        </BracketButton>
        {/* the item form grows up over the whole row, capy too, as wide as the list */}
        <div ref={panelSlotRef} className="absolute inset-x-2.5 bottom-0 sm:inset-x-4" />
      </div>
    </div>
  );
}

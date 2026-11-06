import type { CSSProperties, Ref, RefObject } from "react";
import { Sprite } from "@/components/capy/Sprite";
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

  return (
    // the footer is the add box: no frame of its own, its top line takes the bucket colour while typing.
    // Phones keep room below for the screen's rounded corners
    <div
      style={{ "--accent": color } as CSSProperties}
      className="border-border bg-background sticky bottom-0 z-20 border-t-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] focus-within:border-(--accent) sm:pb-[env(safe-area-inset-bottom)]"
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
        <button
          onClick={() => setChatState(chatOpen ? "closed" : "open")}
          aria-label="chat with capy"
          aria-expanded={chatOpen}
          className={cn(
            "flex size-12 shrink-0 items-center justify-center overflow-hidden transition-transform active:scale-95",
            chatOpen && "bg-card"
          )}
        >
          {/* the sheet's frame is mostly empty space, at 1:1 capy fills the square */}
          <Sprite id="capy-idle-blink" size={64} />
        </button>
        {/* the full form grows up over the whole row, capy too, as wide as the list */}
        {canAdd && bucket && (
          <div ref={panelSlotRef} className="absolute inset-x-2.5 bottom-0 sm:inset-x-4" />
        )}
      </div>
    </div>
  );
}

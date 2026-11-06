import type { RefObject } from "react";
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
  onAdded: () => void;
  onExpand: () => void;
};

export function BucketsFooter({
  bucket,
  color,
  canAdd,
  inputRef,
  onAdded,
  onExpand,
}: BucketsFooterProps) {
  const setChatState = useLayoutStore((s) => s.setChatState);
  const chatOpen = useLayoutStore((s) => s.chatState !== "closed");

  return (
    <div className="border-border bg-background sticky bottom-0 border-t-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-2.5 pt-2 sm:px-4">
        {!bucket ? (
          <p className="text-muted-foreground min-w-0 flex-1 pl-1 font-mono text-xs">
            open a bucket to add to it
          </p>
        ) : canAdd ? (
          <QuickAdd
            key={bucket.id}
            bucket={bucket}
            color={color}
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
      </div>
    </div>
  );
}

import type { CSSProperties, Ref, RefObject } from "react";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
import { cn } from "@/lib/utils";
import { useLookParts } from "@/components/looks/LookProvider";
import type { ViewerBucket } from "@/lib/buckets/access";
import { QuickAdd } from "./QuickAdd";

type BucketsFooterProps = {
  bucket: ViewerBucket | null;
  targets?: { buckets: ViewerBucket[]; onPick: (bucketId: number) => void };
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
  targets,
}: BucketsFooterProps) {
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
            targets={targets}
          />
        ) : (
          <span className="flex-1" />
        )}
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

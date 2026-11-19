import type { CSSProperties, RefObject } from "react";
import { KeyHint } from "@/components/ui/KeyHint";
import { Icon } from "@/components/ui/Icon";
import { Tooltip } from "@/components/ui/Tooltip";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
import { cn } from "@/lib/utils";
import { useLookParts } from "@/components/looks/LookProvider";
import type { ViewerBucket } from "@/lib/buckets/access";
import { BucketTargetPicker } from "./BucketTargetPicker";

type BucketsFooterProps = {
  bucket: ViewerBucket | null;
  targets?: { buckets: ViewerBucket[]; onPick: (bucketId: number) => void };
  color: string;
  canAdd: boolean;
  hidden: boolean;
  buttonRef: RefObject<HTMLButtonElement | null>;
  onAdd: () => void;
};

export function BucketsFooter({
  bucket,
  color,
  canAdd,
  hidden,
  buttonRef,
  onAdd,
  targets,
}: BucketsFooterProps) {
  const keyboardInset = useKeyboardInset();
  const floating = useLookParts().footer === "floating";

  if (hidden) return null;

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
        data-testid="add-box"
        className="max-w-column mx-auto flex min-h-(--add-box-h) w-full items-center gap-2 px-2.5 sm:px-4"
      >
        {!bucket ? (
          <p className="text-muted-foreground font-ui min-w-0 flex-1 text-xs">
            open a bucket to add to it
          </p>
        ) : (
          canAdd && (
            <>
              {targets && (
                <BucketTargetPicker
                  bucket={bucket}
                  buckets={targets.buckets}
                  onPick={targets.onPick}
                />
              )}
              <div className="ml-auto flex items-center gap-2">
                <KeyHint action="quick-add" />
                <Tooltip text="add item">
                  <button
                    ref={buttonRef}
                    type="button"
                    aria-label="add item"
                    onClick={onAdd}
                    className="bg-primary text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-(--chip-radius) transition-opacity hover:opacity-85"
                  >
                    <Icon name="plus" />
                  </button>
                </Tooltip>
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}

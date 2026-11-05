import { useId, useRef, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SWITCH_DOTS_MAX, SWITCH_SWIPE_PX } from "./constants";

type BucketSwitcherProps = {
  count: number;
  index: number;
  onGo: (index: number) => void;
  onOpenPicker: () => void;
  children: ReactNode;
};

// The phone's bucket button: a tap opens the picker, a sideways swipe goes to the next or previous one
export function BucketSwitcher({
  count,
  index,
  onGo,
  onOpenPicker,
  children,
}: BucketSwitcherProps) {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const swipedRef = useRef(false);
  const positionId = useId();

  function onPointerDown(e: PointerEvent) {
    startRef.current = { x: e.clientX, y: e.clientY };
    swipedRef.current = false;
  }

  function onPointerUp(e: PointerEvent) {
    const start = startRef.current;
    startRef.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) < SWITCH_SWIPE_PX || Math.abs(dx) <= Math.abs(dy)) return;
    swipedRef.current = true;
    const next = dx < 0 ? index + 1 : index - 1;
    if (next >= 0 && next < count) onGo(next);
  }

  return (
    <>
      <button
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (startRef.current = null)}
        onClick={() => {
          if (swipedRef.current) swipedRef.current = false;
          else onOpenPicker();
        }}
        aria-haspopup="dialog"
        aria-describedby={positionId}
        className="flex min-h-14 min-w-0 touch-pan-y items-center pr-1 pl-4"
      >
        <span className="flex min-w-0 flex-col items-center gap-1">
          {children}
          {count > 1 && (
            <span
              aria-hidden
              className="text-muted-foreground flex items-center gap-1 font-mono text-[10px] leading-none"
            >
              {count <= SWITCH_DOTS_MAX
                ? Array.from({ length: count }, (_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-1 w-1 rounded-full",
                        i === index ? "bg-foreground" : "bg-muted-foreground/40"
                      )}
                    />
                  ))
                : `${index + 1}/${count}`}
            </span>
          )}
        </span>
      </button>
      <span id={positionId} className="sr-only">
        {`${index + 1} of ${count}, swipe sideways for the next one`}
      </span>
    </>
  );
}

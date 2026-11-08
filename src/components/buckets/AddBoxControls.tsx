import { useRef } from "react";
import { EXPAND_SWIPE_PX } from "./constants";

export function ExpandHandle({ onExpand }: { onExpand: () => void }) {
  const startY = useRef<number | null>(null);
  const swiped = useRef(false);
  return (
    <button
      type="button"
      aria-label="add with details"
      onClick={() => {
        if (swiped.current) swiped.current = false;
        else onExpand();
      }}
      onPointerDown={(e) => {
        startY.current = e.clientY;
        swiped.current = false;
      }}
      onPointerUp={(e) => {
        const from = startY.current;
        startY.current = null;
        if (from === null || from - e.clientY <= EXPAND_SWIPE_PX) return;
        swiped.current = true;
        onExpand();
      }}
      className="text-muted-foreground -mb-2 flex h-6 w-24 touch-none items-center justify-center self-center"
    >
      <span className="h-1 w-10 rounded-full bg-current opacity-30" />
    </button>
  );
}

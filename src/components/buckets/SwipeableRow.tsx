import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

const REVEAL_WIDTH = 128;
const SWIPE_THRESHOLD = 50;

type SwipeableRowProps = {
  children: React.ReactNode;
  onDelete: () => void;
  disabled?: boolean;
};

export function SwipeableRow({ children, onDelete, disabled }: SwipeableRowProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const isDraggingHRef = useRef(false);
  const directionLockedRef = useRef(false);
  const didSwipeRef = useRef(false);

  function snapClose() {
    setIsAnimating(true);
    setTranslateX(0);
    setIsOpen(false);
  }

  function snapOpen() {
    setIsAnimating(true);
    setTranslateX(-REVEAL_WIDTH);
    setIsOpen(true);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (disabled) return;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    isDraggingHRef.current = false;
    directionLockedRef.current = false;
    setIsAnimating(false);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (startXRef.current === null || startYRef.current === null) return;
    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;
    if (!directionLockedRef.current) {
      if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      directionLockedRef.current = true;
      isDraggingHRef.current = Math.abs(dx) > Math.abs(dy);
    }
    if (!isDraggingHRef.current) return;
    e.preventDefault();
    const base = isOpen ? -REVEAL_WIDTH : 0;
    setTranslateX(Math.min(0, Math.max(-REVEAL_WIDTH, base + dx)));
  }

  function onPointerUp() {
    if (startXRef.current === null) return;
    startXRef.current = null;
    startYRef.current = null;
    if (!isDraggingHRef.current) return;
    didSwipeRef.current = true;
    setTimeout(() => {
      didSwipeRef.current = false;
    }, 0);
    isDraggingHRef.current = false;
    directionLockedRef.current = false;
    const moved = Math.abs(translateX);
    if (isOpen) {
      if (moved < REVEAL_WIDTH - SWIPE_THRESHOLD) snapClose();
      else snapOpen();
    } else {
      if (moved > SWIPE_THRESHOLD) snapOpen();
      else snapClose();
    }
  }

  function onClickCapture(e: React.MouseEvent) {
    if (didSwipeRef.current) {
      e.stopPropagation();
      e.preventDefault();
    }
  }

  return (
    <div className="relative overflow-hidden">
      {/* Right side buttons (swipe left → delete) */}
      <div className="absolute top-0 right-0 flex h-full" style={{ width: REVEAL_WIDTH }}>
        <button
          onClick={() => {
            snapClose();
            onDelete();
          }}
          tabIndex={isOpen ? 0 : -1}
          className="text-muted-foreground hover:text-destructive flex flex-1 items-center justify-center font-mono text-xs transition-colors"
        >
          <span className="opacity-50">[</span>delete<span className="opacity-50">]</span>
        </button>
        <button
          onClick={snapClose}
          tabIndex={isOpen ? 0 : -1}
          className="text-muted-foreground hover:text-foreground flex flex-1 items-center justify-center font-mono text-xs transition-colors"
        >
          <span className="opacity-50">[</span>cancel<span className="opacity-50">]</span>
        </button>
      </div>

      {/* Swipeable content layer */}
      <div
        className={cn("bg-background touch-pan-y", isOpen && "select-none")}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isAnimating ? "transform 0.2s ease" : "none",
          willChange: "transform",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={onClickCapture}
        onTransitionEnd={() => setIsAnimating(false)}
      >
        {children}
      </div>
    </div>
  );
}

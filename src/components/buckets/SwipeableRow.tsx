import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { LONG_PRESS_MS, LONG_PRESS_SLOP } from "./constants";
import type { MenuAt } from "./ItemMenu";

const REVEAL_WIDTH = 128;
const SWIPE_THRESHOLD = 50;
const COMPLETE_THRESHOLD = 80;
const COMPLETE_MAX = 112;

type SwipeableRowProps = {
  children: React.ReactNode;
  onDelete: () => void;
  onComplete?: () => void;
  completeLabel?: string;
  disabled?: boolean;
  onMenu?: (at: MenuAt) => void;
};

export function SwipeableRow({
  children,
  onDelete,
  onComplete,
  completeLabel = "done",
  disabled,
  onMenu,
}: SwipeableRowProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const isDraggingHRef = useRef(false);
  const directionLockedRef = useRef(false);
  const didSwipeRef = useRef(false);

  const pointerTypeRef = useRef("mouse");
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);
  const pressAnchorRef = useRef<MenuAt | null>(null);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressMovedRef = useRef(false);
  const pressFiredRef = useRef(false);

  function cancelPressTimer() {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    pressTimerRef.current = null;
  }

  useEffect(() => cancelPressTimer, []);

  function openMenuByPress() {
    cancelPressTimer();
    if (!onMenu || pressFiredRef.current || pressMovedRef.current) return;
    pressFiredRef.current = true;
    startXRef.current = null;
    startYRef.current = null;
    isDraggingHRef.current = false;
    directionLockedRef.current = false;
    if (isOpen) snapOpen();
    else snapClose();
    if (pressAnchorRef.current) onMenu(pressAnchorRef.current);
  }

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
    pointerTypeRef.current = e.pointerType;
    pressStartRef.current = { x: e.clientX, y: e.clientY };
    const row = e.currentTarget.getBoundingClientRect();
    pressAnchorRef.current = { x: e.clientX, top: row.top, bottom: row.bottom };
    pressMovedRef.current = false;
    pressFiredRef.current = false;
    cancelPressTimer();
    if (onMenu && e.pointerType !== "mouse" && !isOpen) {
      pressTimerRef.current = setTimeout(openMenuByPress, LONG_PRESS_MS);
    }
    if (disabled) return;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    isDraggingHRef.current = false;
    directionLockedRef.current = false;
    setIsAnimating(false);
  }

  function onPointerMove(e: React.PointerEvent) {
    const press = pressStartRef.current;
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > LONG_PRESS_SLOP) {
      pressMovedRef.current = true;
      cancelPressTimer();
    }
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
    const max = onComplete && !isOpen ? COMPLETE_MAX : 0;
    setTranslateX(Math.min(max, Math.max(-REVEAL_WIDTH, base + dx)));
  }

  function onPointerUp() {
    cancelPressTimer();
    pressStartRef.current = null;
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
    if (translateX > 0) {
      snapClose();
      if (translateX >= COMPLETE_THRESHOLD) onComplete?.();
      return;
    }
    const moved = Math.abs(translateX);
    if (isOpen) {
      if (moved < REVEAL_WIDTH - SWIPE_THRESHOLD) snapClose();
      else snapOpen();
    } else {
      if (moved > SWIPE_THRESHOLD) snapOpen();
      else snapClose();
    }
  }

  function onPointerCancel() {
    cancelPressTimer();
    startXRef.current = null;
    startYRef.current = null;
    isDraggingHRef.current = false;
    directionLockedRef.current = false;
    if (isOpen) snapOpen();
    else snapClose();
  }

  function onContextMenu(e: React.MouseEvent) {
    if (!onMenu) return;
    e.preventDefault();
    if (pointerTypeRef.current === "mouse") {
      onMenu({ x: e.clientX, top: e.clientY, bottom: e.clientY });
    } else openMenuByPress();
  }

  function onClickCapture(e: React.MouseEvent) {
    if (didSwipeRef.current || pressFiredRef.current) {
      pressFiredRef.current = false;
      e.stopPropagation();
      e.preventDefault();
    }
  }

  return (
    <div className="relative overflow-hidden">
      {onComplete && (
        <div
          aria-hidden
          className={cn(
            "absolute top-0 left-0 flex h-full items-center pl-4 font-mono text-xs transition-colors",
            translateX >= COMPLETE_THRESHOLD ? "text-foreground" : "text-muted-foreground"
          )}
          style={{ width: COMPLETE_MAX }}
        >
          <span className="opacity-50">[</span>
          {completeLabel}
          <span className="opacity-50">]</span>
        </div>
      )}

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
        className={cn(
          "bg-background touch-pan-y",
          (isOpen || onMenu) && "select-none [-webkit-touch-callout:none]"
        )}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isAnimating ? "transform 0.2s ease" : "none",
          willChange: "transform",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={onContextMenu}
        onClickCapture={onClickCapture}
        onTransitionEnd={() => setIsAnimating(false)}
      >
        {children}
      </div>
    </div>
  );
}

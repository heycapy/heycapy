import { useEffect, useRef, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { LONG_PRESS_MS, LONG_PRESS_SLOP } from "./constants";
import type { MenuAt } from "./ItemMenu";
import { MODAL_PANEL_SELECTOR } from "@/components/ui/constants";

type PressableRowProps = {
  children: ReactNode;
  onMenu: (at: MenuAt) => void;
};

export function PressableRow({ children, onMenu }: PressableRowProps) {
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
    if (pressFiredRef.current || pressMovedRef.current || !pressAnchorRef.current) return;
    pressFiredRef.current = true;
    onMenu(pressAnchorRef.current);
  }

  function onPointerDown(e: PointerEvent) {
    pointerTypeRef.current = e.pointerType;
    pressStartRef.current = { x: e.clientX, y: e.clientY };
    const row = e.currentTarget.getBoundingClientRect();
    pressAnchorRef.current = {
      x: e.clientX,
      top: row.top,
      bottom: row.bottom,
      within: e.currentTarget.closest<HTMLElement>(MODAL_PANEL_SELECTOR),
    };
    pressMovedRef.current = false;
    pressFiredRef.current = false;
    cancelPressTimer();
    if (e.pointerType !== "mouse")
      pressTimerRef.current = setTimeout(openMenuByPress, LONG_PRESS_MS);
  }

  function onPointerMove(e: PointerEvent) {
    const press = pressStartRef.current;
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > LONG_PRESS_SLOP) {
      pressMovedRef.current = true;
      cancelPressTimer();
    }
  }

  function onPointerEnd() {
    pressStartRef.current = null;
    cancelPressTimer();
  }

  function onContextMenu(e: MouseEvent) {
    e.preventDefault();
    if (pointerTypeRef.current === "mouse") {
      onMenu({
        x: e.clientX,
        top: e.clientY,
        bottom: e.clientY,
        within: e.currentTarget.closest<HTMLElement>(MODAL_PANEL_SELECTOR),
      });
    } else openMenuByPress();
  }

  // The finger lifting after a long press would otherwise also tap whatever is under it
  function onClickCapture(e: MouseEvent) {
    if (!pressFiredRef.current) return;
    pressFiredRef.current = false;
    e.stopPropagation();
    e.preventDefault();
  }

  return (
    <div
      className="bg-background select-none [-webkit-touch-callout:none]"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onContextMenu={onContextMenu}
      onClickCapture={onClickCapture}
    >
      {children}
    </div>
  );
}

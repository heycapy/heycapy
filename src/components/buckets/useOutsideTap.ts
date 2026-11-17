import { useEffect, useEffectEvent, type RefObject } from "react";
import { POPOVER_SELECTOR } from "@/components/ui/constants";
import { ITEM_LIST_SELECTOR, LONG_PRESS_SLOP, OUTSIDE_TAP_CLICK_MS } from "./constants";

type Press = { x: number; y: number; inside: boolean; popoverOpen: boolean };

// A tap outside the scope and its popovers. Taps on the list are swallowed so they never tick or
// open another row; a tap that only closes a popover leaves the scope open
export function useOutsideTap(scope: RefObject<HTMLElement | null>, onTap: () => void) {
  const tapped = useEffectEvent(onTap);

  useEffect(() => {
    let press: Press | null = null;

    function isInside(target: EventTarget | null) {
      return (
        target instanceof Element &&
        (!!scope.current?.contains(target) || !!target.closest(POPOVER_SELECTOR))
      );
    }

    function swallowNextClick() {
      const eat = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        stop();
      };
      const timer = setTimeout(() => stop(), OUTSIDE_TAP_CLICK_MS);
      function stop() {
        clearTimeout(timer);
        document.removeEventListener("click", eat, true);
      }
      document.addEventListener("click", eat, true);
    }

    function onDown(e: PointerEvent) {
      press = {
        x: e.clientX,
        y: e.clientY,
        inside: isInside(e.target),
        popoverOpen: document.querySelector(POPOVER_SELECTOR) !== null,
      };
    }

    function onUp(e: PointerEvent) {
      const start = press;
      press = null;
      if (!start || start.inside || e.button !== 0 || isInside(e.target)) return;
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > LONG_PRESS_SLOP) return;
      if (e.target instanceof Element && e.target.closest(ITEM_LIST_SELECTOR)) swallowNextClick();
      if (!start.popoverOpen) tapped();
    }

    function onCancel() {
      press = null;
    }

    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("pointerup", onUp, true);
    document.addEventListener("pointercancel", onCancel, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("pointercancel", onCancel, true);
    };
  }, [scope]);
}

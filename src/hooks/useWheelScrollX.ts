import { useEffect, type RefObject } from "react";
import { WHEEL_LINE_PX } from "./constants";

export function useWheelScrollX(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
      const delta = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * WHEEL_LINE_PX : e.deltaY;
      const max = el.scrollWidth - el.clientWidth;
      const canMove = delta < 0 ? el.scrollLeft > 0 : el.scrollLeft < max;
      if (max <= 0 || !canMove) return;
      e.preventDefault();
      el.scrollLeft += delta;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [ref]);
}

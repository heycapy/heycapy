import { useCallback, type RefObject } from "react";

export function useScrollToFirst(containerRef: RefObject<HTMLElement | null>) {
  return useCallback(
    (selector: string) => {
      requestAnimationFrame(() => {
        const el = containerRef.current?.querySelector(selector);
        if (el instanceof HTMLElement) {
          el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      });
    },
    [containerRef]
  );
}

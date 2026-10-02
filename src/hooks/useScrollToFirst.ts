import { useCallback, type RefObject } from "react";

export function useScrollToFirst(containerRef: RefObject<HTMLElement | null>) {
  return useCallback(
    (selector: string) => {
      requestAnimationFrame(() => {
        const container = containerRef.current;
        const el = container?.querySelector(selector);
        if (!container || !(el instanceof HTMLElement)) return;
        const box = container.getBoundingClientRect();
        const target = el.getBoundingClientRect();
        const by =
          target.top < box.top
            ? target.top - box.top
            : target.bottom > box.bottom
              ? target.bottom - box.bottom
              : 0;
        if (by !== 0) container.scrollBy({ top: by, behavior: "smooth" });
      });
    },
    [containerRef]
  );
}

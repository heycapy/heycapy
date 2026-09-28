import { useEffect } from "react";

export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const main = document.querySelector("main") as HTMLElement | null;
    const prevMain = main?.style.overflow ?? "";
    const prevBody = document.body.style.overflow;
    if (main) main.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      if (main) main.style.overflow = prevMain;
      document.body.style.overflow = prevBody;
    };
  }, [active]);
}

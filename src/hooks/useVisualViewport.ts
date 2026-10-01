import { useEffect, useState } from "react";

type VisibleArea = { top: number; height: number };

// iOS Safari keeps the layout viewport when the keyboard opens, so a fixed bottom bar ends up under it
export function useVisualViewport(): VisibleArea | null {
  const [area, setArea] = useState<VisibleArea | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const viewport = vv;
    function update() {
      setArea({ top: viewport.offsetTop, height: viewport.height });
    }
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  return area;
}

import { useEffect, useState } from "react";
import { KEYBOARD_MIN_PX } from "@/constants";

export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const viewport = vv;
    function update() {
      const covered = window.innerHeight - viewport.offsetTop - viewport.height;
      setInset(covered >= KEYBOARD_MIN_PX ? Math.round(covered) : 0);
    }
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    window.addEventListener("focusout", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      window.removeEventListener("focusout", update);
    };
  }, []);

  return inset;
}

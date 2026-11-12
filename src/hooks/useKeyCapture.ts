import { useEffect, useEffectEvent } from "react";
import { isModifierKey } from "@/lib/keybinds/match";
import { useLayoutStore } from "@/store/layout";

export function useKeyCapture(active: boolean, onKey: (e: KeyboardEvent) => void) {
  const setKeyCapture = useLayoutStore((s) => s.setKeyCapture);
  const handle = useEffectEvent(onKey);

  useEffect(() => {
    if (!active) return;
    function onKeyDown(e: KeyboardEvent) {
      if (isModifierKey(e)) return;
      e.preventDefault();
      e.stopPropagation();
      handle(e);
    }
    setKeyCapture(true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      setKeyCapture(false);
    };
  }, [active, setKeyCapture]);
}

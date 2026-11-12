import { useEffect, useEffectEvent } from "react";
import { isModifierKey } from "@/lib/keybinds/match";
import { useLayoutStore } from "@/store/layout";

type KeyCaptureOptions = {
  onModifier?: (e: KeyboardEvent) => void;
  // Enter and Space on a focused button press it instead of being recorded
  activateButtons?: boolean;
};

function activatesButton(e: KeyboardEvent) {
  return (
    (e.key === "Enter" || e.key === " ") &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.altKey &&
    e.target instanceof HTMLButtonElement
  );
}

export function useKeyCapture(
  active: boolean,
  onKey: (e: KeyboardEvent) => void,
  options: KeyCaptureOptions = {}
) {
  const setKeyCapture = useLayoutStore((s) => s.setKeyCapture);
  const handle = useEffectEvent(onKey);
  const hold = useEffectEvent((e: KeyboardEvent) => options.onModifier?.(e));
  const activateButtons = options.activateButtons === true;

  useEffect(() => {
    if (!active) return;
    function onKeyDown(e: KeyboardEvent) {
      if (isModifierKey(e)) return hold(e);
      if (e.key === "Tab" && !e.ctrlKey && !e.metaKey && !e.altKey) return;
      if (activateButtons && activatesButton(e)) return;
      e.preventDefault();
      e.stopPropagation();
      handle(e);
    }
    function onKeyUp(e: KeyboardEvent) {
      if (isModifierKey(e)) hold(e);
    }
    setKeyCapture(true);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      setKeyCapture(false);
    };
  }, [active, activateButtons, setKeyCapture]);
}

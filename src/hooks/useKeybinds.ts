import { useEffect, useEffectEvent, useMemo } from "react";
import { ESCAPE_KEY, PREFIX_TIMEOUT_MS } from "@/lib/keybinds/constants";
import type { KeybindActionId } from "@/lib/keybinds/constants";
import {
  defaultPrefix,
  isModifierKey,
  matchesPrefix,
  mergeBindings,
  resolveAction,
} from "@/lib/keybinds/match";
import type { StoredKeybinds } from "@/lib/keybinds/schema";
import { useLayoutStore } from "@/store/layout";

const MAC_PLATFORM = /Mac|iPhone|iPad/;

export function useKeybinds(
  stored: StoredKeybinds,
  onAction: (id: KeybindActionId) => void,
  onEscape: (e: KeyboardEvent) => void
) {
  const setPrefixActive = useLayoutStore((s) => s.setPrefixActive);
  const act = useEffectEvent(onAction);
  const escape = useEffectEvent(onEscape);
  const storedPrefix = stored.prefix ?? null;
  const bindings = useMemo(() => mergeBindings(stored.bindings ?? {}), [stored.bindings]);

  useEffect(() => {
    const prefix = storedPrefix ?? defaultPrefix(MAC_PLATFORM.test(navigator.userAgent));
    let armed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function disarm() {
      clearTimeout(timer);
      armed = false;
      setPrefixActive(false);
    }

    function swallow(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat) return;
      if (armed) {
        if (isModifierKey(e)) return;
        disarm();
        if (e.key === ESCAPE_KEY) return swallow(e);
        const id = resolveAction(e, bindings);
        if (!id) return;
        swallow(e);
        act(id);
        return;
      }
      if (!matchesPrefix(e, prefix)) return;
      swallow(e);
      armed = true;
      setPrefixActive(true);
      timer = setTimeout(disarm, PREFIX_TIMEOUT_MS);
    }

    function onEscapeKey(e: KeyboardEvent) {
      if (e.key === ESCAPE_KEY && !e.defaultPrevented) escape(e);
    }

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keydown", onEscapeKey);
    window.addEventListener("blur", disarm);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keydown", onEscapeKey);
      window.removeEventListener("blur", disarm);
      disarm();
    };
  }, [storedPrefix, bindings, setPrefixActive]);
}

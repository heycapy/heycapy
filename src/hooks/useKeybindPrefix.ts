import { useMemo, useSyncExternalStore } from "react";
import { defaultPrefix, formatPrefix } from "@/lib/keybinds/match";
import type { StoredKeybinds } from "@/lib/keybinds/schema";

const MAC_PLATFORM = /Mac|iPhone|iPad/;
const noSubscription = () => () => {};

export function useIsMac(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => MAC_PLATFORM.test(navigator.userAgent),
    () => false
  );
}

export function useKeybindPrefix(stored: StoredKeybinds) {
  const isMac = useIsMac();
  const custom = stored.prefix ?? null;
  return useMemo(() => {
    const prefix = custom ?? defaultPrefix(isMac);
    return { prefix, label: formatPrefix(prefix, isMac) };
  }, [custom, isMac]);
}

"use client";

import { Kbd } from "./Kbd";
import { useStoredKeybinds } from "@/components/providers/KeybindsProvider";
import type { KeybindActionId } from "@/lib/keybinds/constants";
import { formatKey, mergeBindings } from "@/lib/keybinds/match";
import { cn } from "@/lib/utils";

type KeyHintProps = { action: KeybindActionId; className?: string };

export function KeyHint({ action, className }: KeyHintProps) {
  const stored = useStoredKeybinds();
  if (!stored.hints) return null;
  return (
    <Kbd
      aria-hidden
      className={cn("ml-1.5 min-w-4 shrink-0 px-1 font-normal pointer-coarse:hidden", className)}
    >
      {formatKey(mergeBindings(stored.bindings ?? {})[action])}
    </Kbd>
  );
}

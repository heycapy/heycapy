"use client";

import { Kbd } from "./Kbd";
import { useStoredKeybinds } from "@/components/providers/KeybindsProvider";
import { useIsMac } from "@/hooks/useKeybindPrefix";
import type { KeybindActionId } from "@/lib/keybinds/constants";
import { formatKey, mergeBindings } from "@/lib/keybinds/match";
import { submitKeys } from "@/lib/keybinds/submit";
import { cn } from "@/lib/utils";

type HintBadgeProps = { text: string; className?: string };

function HintBadge({ text, className }: HintBadgeProps) {
  return (
    <Kbd
      aria-hidden
      className={cn("no-fine-pointer:hidden ml-1.5 min-w-4 shrink-0 px-1 font-normal", className)}
    >
      {text}
    </Kbd>
  );
}

type KeyHintProps = { action: KeybindActionId; className?: string };

export function KeyHint({ action, className }: KeyHintProps) {
  const stored = useStoredKeybinds();
  if (!stored.hints) return null;
  return (
    <HintBadge
      text={formatKey(mergeBindings(stored.bindings ?? {})[action])}
      className={className}
    />
  );
}

type SubmitKeyHintProps = { form?: boolean; className?: string };

export function SubmitKeyHint({ form = false, className }: SubmitKeyHintProps) {
  const stored = useStoredKeybinds();
  const isMac = useIsMac();
  if (!stored.hints) return null;
  return <HintBadge text={submitKeys(isMac, form)} className={className} />;
}

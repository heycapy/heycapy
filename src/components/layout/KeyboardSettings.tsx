"use client";

import { useState } from "react";
import { saveKeybindsAction } from "@/app/(app)/actions";
import { useStoredKeybinds } from "@/components/providers/KeybindsProvider";
import { Toggle } from "@/components/ui/Toggle";
import { useKeybindPrefix } from "@/hooks/useKeybindPrefix";
import type { KeybindEditing } from "@/lib/keybinds/constants";
import { withHints } from "@/lib/keybinds/edit";
import type { StoredKeybinds } from "@/lib/keybinds/schema";
import { PrefixSection } from "./PrefixSection";
import { ShortcutRows } from "./ShortcutRows";
import { HINT, LABEL } from "./settings-constants";
import { useSaveSetting } from "./useSaveSetting";

export function KeyboardSettings() {
  const stored = useStoredKeybinds();
  const { label } = useKeybindPrefix(stored);
  const { pending, save } = useSaveSetting();
  const [editing, setEditing] = useState<KeybindEditing>(null);

  // buttons stay enabled while saving: a disabled one drops focus, and Escape then can't close tweaks
  function commit(next: StoredKeybinds) {
    if (!pending) save(saveKeybindsAction, next);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <label className={LABEL}>keybindings</label>
        <span className={HINT}>
          Press the prefix, then one key. {label} then ? shows them all. Esc closes whatever is
          open.
        </span>
      </div>

      <PrefixSection stored={stored} editing={editing} setEditing={setEditing} commit={commit} />

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <label className={LABEL}>key hints on buttons</label>
          <Toggle
            label="key hints on buttons"
            value={stored.hints === true}
            onChange={(value) => commit(withHints(stored, value))}
          />
        </div>
        <span className={HINT}>
          Shows the key on the buttons it works for. Not on touch screens.
        </span>
      </div>

      <ShortcutRows stored={stored} editing={editing} setEditing={setEditing} commit={commit} />
    </div>
  );
}

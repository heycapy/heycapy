"use client";

import { Toggle } from "@/components/ui/Toggle";
import { useUIStore } from "@/store/ui";
import { useLayoutStore } from "@/store/layout";
import { HINT, SECTION } from "./settings-constants";

export function FocusSetting() {
  const focusMode = useUIStore((s) => s.focusMode);
  const setFocusMode = useUIStore((s) => s.setFocusMode);
  const closeSidePanel = useLayoutStore((s) => s.closeSidePanel);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className={SECTION}>focus mode</label>
        <Toggle
          label="focus mode"
          value={focusMode}
          onChange={(on) => {
            setFocusMode(on);
            if (on) closeSidePanel("tweaks");
          }}
        />
      </div>
      <span className={HINT}>just the open bucket, its items and the add box</span>
    </div>
  );
}

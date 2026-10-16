"use client";

import { presetCells, type AvatarCells } from "@/lib/account/avatar";
import { AVATAR_PRESETS } from "@/lib/account/avatar-presets";
import { LABEL } from "@/components/layout/settings-constants";
import { Avatar } from "./Avatar";

type AvatarPresetsProps = {
  disabled?: boolean;
  onPick: (cells: AvatarCells) => void;
};

export function AvatarPresets({ disabled, onPick }: AvatarPresetsProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className={LABEL}>start from</p>
      <div className="grid w-fit grid-cols-6 gap-1.5" role="group" aria-label="start from">
        {AVATAR_PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            aria-label={preset.name}
            title={preset.name}
            onClick={() => onPick(presetCells(preset.rows, preset.background))}
            disabled={disabled}
            className="border-border hover:bg-muted border p-1 transition-colors disabled:opacity-40"
          >
            <Avatar cells={presetCells(preset.rows, preset.background)} size={32} />
          </button>
        ))}
      </div>
    </div>
  );
}

"use client";

import { OptionButton } from "@/components/ui/OptionButton";
import { BracketButton } from "@/components/ui/BracketButton";
import { AVATAR_PALETTE } from "@/lib/account/constants";
import { cn } from "@/lib/utils";
import { AVATAR_TOOLS, type AvatarTool } from "./avatar-constants";

type AvatarToolbarProps = {
  tool: AvatarTool;
  colour: number;
  mirror: boolean;
  canUndo: boolean;
  canRedo: boolean;
  disabled?: boolean;
  onTool: (tool: AvatarTool) => void;
  onColour: (index: number) => void;
  onMirror: (mirror: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
};

export function AvatarToolbar(props: AvatarToolbarProps) {
  const { tool, colour, mirror, disabled } = props;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1">
        {AVATAR_TOOLS.map((option) => (
          <OptionButton
            key={option}
            active={tool === option}
            onClick={() => props.onTool(option)}
            disabled={disabled}
          >
            {option}
          </OptionButton>
        ))}
        <OptionButton active={mirror} onClick={() => props.onMirror(!mirror)} disabled={disabled}>
          mirror
        </OptionButton>
      </div>

      <div className="grid w-fit grid-cols-8 gap-1.5" role="group" aria-label="colours">
        {AVATAR_PALETTE.map((entry, index) => (
          <button
            key={entry.name}
            type="button"
            aria-label={entry.name}
            aria-pressed={colour === index}
            title={entry.name}
            onClick={() => props.onColour(index)}
            disabled={disabled}
            className={cn(
              "border-border size-7 border transition-shadow disabled:opacity-40",
              entry.swatch,
              colour === index && "ring-foreground ring-offset-background ring-2 ring-offset-2"
            )}
          />
        ))}
      </div>

      <div className="flex gap-3">
        <BracketButton onClick={props.onUndo} disabled={disabled || !props.canUndo}>
          undo
        </BracketButton>
        <BracketButton onClick={props.onRedo} disabled={disabled || !props.canRedo}>
          redo
        </BracketButton>
        <BracketButton variant="destructive" onClick={props.onClear} disabled={disabled}>
          clear
        </BracketButton>
      </div>
    </div>
  );
}

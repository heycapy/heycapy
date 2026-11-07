"use client";

import { OptionButton } from "@/components/ui/OptionButton";
import { Icon } from "@/components/ui/Icon";
import type { IconName } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { useId } from "react";
import { Tooltip } from "@/components/ui/Tooltip";

type DetailChipProps = {
  name: string;
  label: string;
  set: boolean;
  open: boolean;
  icon?: IconName;
  dot?: string;
  hint?: string;
  onClick: () => void;
};

export function DetailChip({ name, label, set, open, icon, dot, hint, onClick }: DetailChipProps) {
  const hintId = useId();
  return (
    <Tooltip text={hint} className="max-w-full">
      <OptionButton
        active={open}
        aria-pressed={undefined}
        aria-expanded={open}
        aria-label={set ? `${name}: ${label}` : name}
        onClick={onClick}
        aria-describedby={hint ? hintId : undefined}
        className={cn(
          "inline-flex max-w-full items-center gap-1.5",
          set && !open && "text-foreground",
          hint && !open && "opacity-50"
        )}
      >
        {dot ? (
          <span
            aria-hidden
            className="size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: dot }}
          />
        ) : (
          icon && <Icon name={icon} className="shrink-0" />
        )}
        <span className="truncate">{label}</span>
        {hint && (
          <span id={hintId} hidden>
            {hint}
          </span>
        )}
      </OptionButton>
    </Tooltip>
  );
}

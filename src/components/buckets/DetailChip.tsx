"use client";

import { OptionButton } from "@/components/ui/OptionButton";
import { Icon } from "@/components/ui/Icon";
import type { IconName } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

type DetailChipProps = {
  name: string;
  label: string;
  set: boolean;
  open: boolean;
  icon?: IconName;
  dot?: string;
  onClick: () => void;
};

export function DetailChip({ name, label, set, open, icon, dot, onClick }: DetailChipProps) {
  return (
    <OptionButton
      active={open}
      aria-pressed={undefined}
      aria-expanded={open}
      aria-label={set ? `${name}: ${label}` : name}
      onClick={onClick}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5",
        set && !open && "text-foreground"
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
    </OptionButton>
  );
}

"use client";

import { OptionButton } from "@/components/ui/OptionButton";
import { Icon } from "@/components/ui/Icon";
import type { IconName } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { useId, type Ref } from "react";
import { Tooltip } from "@/components/ui/Tooltip";

type DetailChipProps = {
  name: string;
  label: string;
  prefix?: string;
  required?: boolean;
  set: boolean;
  open: boolean;
  icon?: IconName;
  dot?: string;
  hint?: string;
  invalid?: boolean;
  fieldKey?: string;
  ref?: Ref<HTMLButtonElement>;
  onClick: () => void;
};

export function DetailChip({
  name,
  label,
  prefix,
  required,
  set,
  open,
  icon,
  dot,
  hint,
  invalid,
  fieldKey,
  ref,
  onClick,
}: DetailChipProps) {
  const hintId = useId();
  return (
    <Tooltip text={hint} className="max-w-full">
      <OptionButton
        ref={ref}
        data-field-key={fieldKey}
        active={open}
        pill
        aria-pressed={undefined}
        aria-expanded={open}
        aria-label={set ? `${name}: ${label}` : name}
        onClick={onClick}
        aria-describedby={hint ? hintId : undefined}
        className={cn(
          "inline-flex max-w-full items-center gap-1.5",
          set && !open && "text-foreground",
          invalid && "border-destructive text-destructive",
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
        {prefix && <span className="text-muted-foreground shrink-0">{prefix}</span>}
        <span className="truncate">{label}</span>
        {required && (
          <span aria-hidden className="text-destructive -ml-0.5 shrink-0 after:content-['*']" />
        )}
        {hint && (
          <span id={hintId} hidden>
            {hint}
          </span>
        )}
      </OptionButton>
    </Tooltip>
  );
}

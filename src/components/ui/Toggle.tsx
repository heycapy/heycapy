"use client";

import { cn } from "@/lib/utils";
import { useLookParts } from "@/components/looks/LookProvider";
import { OptionButton } from "./OptionButton";

type ToggleProps = {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
};

export function Toggle({ label, value, onChange, disabled }: ToggleProps) {
  if (useLookParts().toggle === "switch") {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!value)}
        className="group/switch inline-flex min-h-(--control-h) items-center self-start disabled:opacity-40"
      >
        <span
          aria-hidden
          className={cn(
            "flex h-5 w-9 items-center rounded-full p-0.5 transition-colors",
            value
              ? "bg-primary"
              : "bg-muted-foreground/30 group-hover/switch:bg-muted-foreground/45"
          )}
        >
          <span
            className={cn(
              "bg-background size-4 rounded-full shadow-sm transition-transform",
              value && "translate-x-4"
            )}
          />
        </span>
      </button>
    );
  }
  return (
    <div role="group" aria-label={label} className="flex gap-1">
      <OptionButton active={value} onClick={() => onChange(true)} disabled={disabled}>
        on
      </OptionButton>
      <OptionButton active={!value} onClick={() => onChange(false)} disabled={disabled}>
        off
      </OptionButton>
    </div>
  );
}

"use client";

import { OptionButton } from "./OptionButton";

interface ToggleProps {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ value, onChange, disabled }: ToggleProps) {
  return (
    <div className="flex gap-1">
      <OptionButton active={value} onClick={() => onChange(true)} disabled={disabled}>
        on
      </OptionButton>
      <OptionButton active={!value} onClick={() => onChange(false)} disabled={disabled}>
        off
      </OptionButton>
    </div>
  );
}

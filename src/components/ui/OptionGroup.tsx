"use client";

import { OptionButton } from "./OptionButton";

interface OptionGroupProps<T extends string> {
  options: { value: T; label: string }[];
  value: T | T[];
  onChange: (v: T) => void;
  multi?: boolean;
  disabled?: boolean;
}

export function OptionGroup<T extends string>({
  options,
  value,
  onChange,
  multi,
  disabled,
}: OptionGroupProps<T>) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = multi ? (value as T[]).includes(opt.value) : (value as T) === opt.value;
        return (
          <OptionButton
            key={opt.value}
            active={active}
            onClick={() => onChange(opt.value)}
            disabled={disabled}
          >
            {opt.label}
          </OptionButton>
        );
      })}
    </div>
  );
}

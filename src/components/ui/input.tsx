"use client";

import { cn } from "@/lib/utils";
import { useState, type InputHTMLAttributes, type ChangeEvent } from "react";

export function Input({
  className,
  maxLength,
  value,
  onChange,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const [internalValue, setInternalValue] = useState("");

  const current = value !== undefined ? String(value) : internalValue;
  const pct = maxLength ? current.length / maxLength : 0;

  const countColor =
    pct >= 1
      ? "text-destructive"
      : pct >= 0.75
        ? "text-orange-500"
        : pct >= 0.5
          ? "text-yellow-500"
          : "text-muted-foreground/40";

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    if (value === undefined) setInternalValue(e.target.value);
    onChange?.(e);
  }

  return (
    <div className="w-full">
      <input
        className={cn(
          "border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring w-full rounded-md border px-3 py-2.5 text-sm outline-none focus:ring-1",
          className
        )}
        maxLength={maxLength}
        value={value}
        onChange={handleChange}
        {...props}
      />
      {maxLength && (
        <p className={cn("mt-0.5 text-right font-mono text-[9px] transition-colors", countColor)}>
          {current.length}/{maxLength}
        </p>
      )}
    </div>
  );
}

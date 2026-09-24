"use client";

import { cn } from "@/lib/utils";
import { useState, type InputHTMLAttributes, type ChangeEvent } from "react";

export function charCountColor(length: number, max: number): string {
  const pct = length / max;
  if (pct >= 1) return "text-destructive";
  if (pct >= 0.75) return "text-orange-500";
  if (pct >= 0.5) return "text-yellow-500";
  return "text-muted-foreground/40";
}

export function Input({
  className,
  maxLength,
  value,
  onChange,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const [internalValue, setInternalValue] = useState("");

  const current = value !== undefined ? String(value) : internalValue;

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
        <p
          className={cn(
            "mt-0.5 text-right font-mono text-[9px] transition-colors",
            charCountColor(current.length, maxLength)
          )}
        >
          {current.length}/{maxLength}
        </p>
      )}
    </div>
  );
}

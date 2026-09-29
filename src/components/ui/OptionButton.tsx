"use client";

import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes } from "react";

interface OptionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export function OptionButton({ active = false, className, ...props }: OptionButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "border px-2.5 py-1.5 font-mono text-xs transition-[color,border-color,background-color,transform,box-shadow] disabled:opacity-40",
        active
          ? "border-foreground bg-foreground text-background translate-x-[2px] translate-y-[2px]"
          : cn(
              "border-border/50 text-muted-foreground",
              "shadow-[2px_2px_0_var(--border)]",
              "hover:border-border hover:text-foreground",
              "active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            ),
        className
      )}
      {...props}
    />
  );
}

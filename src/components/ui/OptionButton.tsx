"use client";

import { cn } from "@/lib/utils";
import { useLookParts } from "@/components/looks/LookProvider";
import { type ButtonHTMLAttributes } from "react";

interface OptionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export function OptionButton({ active = false, className, ...props }: OptionButtonProps) {
  const raised = useLookParts().optionButton === "raised";
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "rounded-control font-ui border text-xs transition-[color,border-color,background-color,transform,box-shadow] disabled:opacity-40",
        raised ? "px-2.5 py-1.5" : "inline-flex min-h-10 items-center px-3",
        raised &&
          (active
            ? "border-foreground bg-foreground text-background translate-x-[2px] translate-y-[2px]"
            : cn(
                "border-border/50 text-muted-foreground",
                "shadow-raised-sm",
                "hover:border-border hover:text-foreground",
                "active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              )),
        !raised &&
          (active
            ? "border-foreground/25 bg-muted text-foreground"
            : "border-border/60 text-muted-foreground hover:bg-muted/60 hover:text-foreground"),
        className
      )}
      {...props}
    />
  );
}

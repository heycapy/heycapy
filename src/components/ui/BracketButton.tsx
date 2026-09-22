"use client";

import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes } from "react";

interface BracketButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * default   — used on normal bg. base: text-foreground/60, hover: text-foreground.
   *             Fixes terminal theme where muted-foreground (#00aa2b) on black is invisible.
   * inverted  — used on inverted bg (title bars with bg-foreground). opacity-based so it
   *             inherits the text-background color correctly.
   * destructive — base: text-foreground/60, hover: text-destructive.
   */
  variant?: "default" | "inverted" | "destructive";
}

export function BracketButton({
  variant = "default",
  className,
  children,
  ...props
}: BracketButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center font-mono text-xs transition-colors disabled:opacity-25",
        variant === "default" && "text-foreground/60 hover:text-foreground",
        variant === "inverted" && "opacity-60 transition-opacity hover:opacity-100",
        variant === "destructive" && "text-foreground/60 hover:text-destructive",
        className
      )}
      {...props}
    >
      <span className="opacity-50">[</span>
      {children}
      <span className="opacity-50">]</span>
    </button>
  );
}

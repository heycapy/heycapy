"use client";

import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes } from "react";

interface BracketButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * default     — base: text-muted-foreground, hover: text-foreground.
   * inverted    — used on inverted bg (title bars with bg-foreground). opacity-based.
   * destructive — base: text-muted-foreground, hover: text-destructive (red).
   * warning     — base: text-muted-foreground, hover: text-warning (yellow).
   */
  variant?: "default" | "inverted" | "destructive" | "warning";
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
        variant === "default" && "text-muted-foreground hover:text-foreground",
        variant === "inverted" && "opacity-60 transition-opacity hover:opacity-100",
        variant === "destructive" && "text-muted-foreground hover:text-destructive",
        variant === "warning" && "text-muted-foreground hover:text-warning",
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

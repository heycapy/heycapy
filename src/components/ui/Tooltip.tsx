"use client";

import { useState, type ReactNode, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { TOOLTIP_FLIP_PX } from "./constants";

type TooltipProps = {
  text?: string;
  className?: string;
  children: ReactNode;
};

export function Tooltip({ text, className, children }: TooltipProps) {
  const [at, setAt] = useState<{ x: number; y: number; below: boolean } | null>(null);
  if (!text) return children;

  function show(e: SyntheticEvent<HTMLElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const below = r.top < TOOLTIP_FLIP_PX;
    setAt({ x: r.left + r.width / 2, y: below ? r.bottom : r.top, below });
  }

  return (
    <span
      className={cn("inline-flex", className)}
      onMouseEnter={show}
      onMouseLeave={() => setAt(null)}
      onFocus={show}
      onBlur={() => setAt(null)}
    >
      {children}
      {at &&
        createPortal(
          <span
            role="tooltip"
            style={{ left: at.x, top: at.y }}
            className={cn(
              "bg-background text-foreground border-border rounded-control border-frame shadow-raised-sm font-ui text-2xs pointer-events-none fixed z-[90] -translate-x-1/2 px-2 py-1 whitespace-nowrap [@media(hover:none)]:hidden",
              at.below ? "translate-y-1.5" : "-translate-y-[calc(100%+6px)]"
            )}
          >
            {text}
          </span>,
          document.body
        )}
    </span>
  );
}

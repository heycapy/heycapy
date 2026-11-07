"use client";

import { useLookParts } from "@/components/looks/LookProvider";
import { cn } from "@/lib/utils";

type TickBoxProps = {
  title: string;
  checked: boolean;
  color: string;
  onToggle?: () => void;
};

export function TickBox({ title, checked, color, onToggle }: TickBoxProps) {
  const round = useLookParts().tickBox === "round";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={title}
      disabled={!onToggle}
      onClick={onToggle}
      style={checked ? { color } : undefined}
      className={cn(
        "group/tick flex shrink-0 items-center justify-center disabled:cursor-default",
        round ? "-ml-3 min-h-11 w-11" : "-ml-1.5 pr-2.5 pl-1.5",
        !checked && "text-muted-foreground"
      )}
    >
      {round ? (
        <RoundTick checked={checked} hover={!checked && !!onToggle} />
      ) : (
        <PixelTick checked={checked} hover={!checked && !!onToggle} />
      )}
    </button>
  );
}

function PixelTick({ checked, hover }: { checked: boolean; hover: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" shapeRendering="crispEdges" aria-hidden>
      <path
        d="M1 0h12v1H1zM1 13h12v1H1zM0 1h1v12H0zM13 1h1v12h-1z"
        fill="currentColor"
        className={cn(
          "transition-opacity",
          !checked && "opacity-40",
          hover && "group-hover/tick:opacity-100"
        )}
      />
      {checked && <path d="M4 4h6v6H4z" fill="currentColor" />}
    </svg>
  );
}

function RoundTick({ checked, hover }: { checked: boolean; hover: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-5 items-center justify-center rounded-full border-2 border-current transition-colors",
        checked && "bg-current",
        hover && "group-hover/tick:text-foreground"
      )}
    >
      {checked && (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          className="stroke-background"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )}
    </span>
  );
}

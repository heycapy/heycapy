"use client";

import { cn } from "@/lib/utils";
import { useLookParts } from "@/components/looks/LookProvider";
import { THEMES } from "./settings-constants";

type ThemeSwatchesProps = {
  theme: string | undefined;
  onPick: (theme: string) => void;
};

export function ThemeSwatches({ theme, onPick }: ThemeSwatchesProps) {
  const raised = useLookParts().optionButton === "raised";
  return (
    <div className="grid grid-cols-3 gap-2">
      {THEMES.map((t) => (
        <button
          key={t.id}
          onClick={() => onPick(t.id)}
          aria-pressed={theme === t.id}
          className="flex flex-col items-center gap-1.5"
        >
          <span
            className="border-border border-frame rounded-control h-8 w-full transition-all"
            style={{
              background: t.bg,
              borderColor: theme === t.id ? t.fg : undefined,
              boxShadow:
                theme !== t.id
                  ? undefined
                  : raised
                    ? `2px 2px 0 ${t.fg}`
                    : `0 0 0 2px var(--background), 0 0 0 4px ${t.fg}`,
            }}
          />
          <span
            className={cn(
              "font-ui text-center text-xs leading-tight",
              theme === t.id ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {t.label}
          </span>
        </button>
      ))}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { MenuItem } from "@/components/ui/MenuItem";
import { cn } from "@/lib/utils";
import { THEMES } from "./settings-constants";

type Theme = (typeof THEMES)[number];

type ThemePickerProps = {
  theme: string | undefined;
  onPick: (theme: string) => void;
};

function Dots({ theme }: { theme: Theme }) {
  return (
    <span aria-hidden className="flex shrink-0 gap-1">
      {[theme.bg, theme.accent].map((color) => (
        <span
          key={color}
          className="border-foreground/25 size-3 rounded-(--dot-radius) border"
          style={{ backgroundColor: color }}
        />
      ))}
    </span>
  );
}

export function ThemePicker({ theme, onPick }: ThemePickerProps) {
  const [open, setOpen] = useState(false);
  const current = THEMES.find((t) => t.id === theme) ?? THEMES[0];

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-expanded={open}
        aria-label={`theme, ${current.label}`}
        onClick={() => setOpen((v) => !v)}
        className="border-border border-frame rounded-control font-ui text-foreground flex w-full items-center gap-2 px-2 py-1.5 text-xs"
      >
        <Dots theme={current} />
        <span className="flex-1 truncate text-left">{current.label}</span>
        <Icon
          name="chevron-right"
          className={cn("text-muted-foreground transition-transform", open && "rotate-90")}
        />
      </button>
      {open && (
        <div role="group" aria-label="themes" className="flex max-h-64 flex-col overflow-y-auto">
          {THEMES.map((t) => (
            <MenuItem
              key={t.id}
              aria-pressed={t.id === current.id}
              onClick={() => {
                onPick(t.id);
                setOpen(false);
              }}
              className={cn(
                "gap-2",
                t.id === current.id ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <Dots theme={t} />
              <span className="truncate">{t.label}</span>
            </MenuItem>
          ))}
        </div>
      )}
    </div>
  );
}

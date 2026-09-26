"use client";

import { cn } from "@/lib/utils";
import { charCountColor } from "@/components/ui/input";
import { LABEL, INPUT, THEMES } from "./settings-constants";
import { TIMEZONE_MAX_LENGTH } from "@/constants";

interface AppearanceTabProps {
  theme: string | undefined;
  setTheme: (t: string) => void;
  timezone: string;
  setTimezone: (v: string) => void;
  pending: boolean;
}

export function AppearanceTab({
  theme,
  setTheme,
  timezone,
  setTimezone,
  pending,
}: AppearanceTabProps) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>theme</label>
        <div className="grid grid-cols-3 gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className="flex flex-col items-center gap-1.5"
            >
              <span
                className="border-border h-8 w-full border-2 transition-all"
                style={{
                  background: t.bg,
                  borderColor: theme === t.id ? t.fg : undefined,
                  boxShadow: theme === t.id ? `2px 2px 0 ${t.fg}` : undefined,
                }}
              />
              <span
                className={cn(
                  "text-center font-mono text-[10px] leading-tight",
                  theme === t.id ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>timezone</label>
        <input
          type="text"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          placeholder="America/New_York"
          maxLength={TIMEZONE_MAX_LENGTH}
          disabled={pending}
          className={INPUT}
        />
        {timezone.length > 0 && (
          <p
            className={cn(
              "mt-0.5 text-right font-mono text-[9px] transition-colors",
              charCountColor(timezone.length, TIMEZONE_MAX_LENGTH)
            )}
          >
            {timezone.length}/{TIMEZONE_MAX_LENGTH}
          </p>
        )}
      </div>
    </>
  );
}

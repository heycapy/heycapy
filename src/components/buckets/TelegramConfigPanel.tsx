import { formatSlot } from "@/lib/format-date";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { TELEGRAM_ALIAS_MAX_LENGTH } from "@/constants";
import {
  DEFAULT_TELEGRAM_BOT_CONFIG,
  TELEGRAM_DEADLINE_PRESETS,
  TELEGRAM_RECURRING_OPTIONS,
  TELEGRAM_TIME_SLOT_OPTIONS,
} from "./constants";
import type {
  TelegramBotConfig,
  TelegramDeadlinePreset,
  TelegramRecurringDefault,
} from "./constants";

type TelegramConfigPanelProps = {
  config: TelegramBotConfig;
  onChange: (config: TelegramBotConfig) => void;
  disabled?: boolean;
};

const STANDARD_SLOT_VALUES = new Set(TELEGRAM_TIME_SLOT_OPTIONS.map((o) => o.value));

function parseCustomTimeToHHMM(input: string): string | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, "");
  const ampm = s.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/);
  if (ampm) {
    let h = parseInt(ampm[1] ?? "0");
    const m = parseInt(ampm[2] ?? "0");
    if (ampm[3] === "pm" && h !== 12) h += 12;
    if (ampm[3] === "am" && h === 12) h = 0;
    if (h >= 0 && h < 24 && m >= 0 && m < 60)
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  const h24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (h24) {
    const h = parseInt(h24[1] ?? "0");
    const m = parseInt(h24[2] ?? "0");
    if (h >= 0 && h < 24 && m >= 0 && m < 60)
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  return null;
}

export function TelegramConfigPanel({ config, onChange, disabled }: TelegramConfigPanelProps) {
  const [customInput, setCustomInput] = useState("");
  const [customError, setCustomError] = useState("");

  function set<K extends keyof TelegramBotConfig>(key: K, value: TelegramBotConfig[K]) {
    onChange({ ...config, [key]: value });
  }

  function toggleStandardSlot(hhmm: string) {
    const active = config.timeSlots.includes(hhmm);
    if (active && config.timeSlots.length === 1) return;
    const next = active
      ? config.timeSlots.filter((s) => s !== hhmm)
      : [...config.timeSlots, hhmm].sort();
    set("timeSlots", next);
  }

  function removeSlot(hhmm: string) {
    if (config.timeSlots.length === 1) return;
    set(
      "timeSlots",
      config.timeSlots.filter((s) => s !== hhmm)
    );
  }

  function addCustomSlot() {
    setCustomError("");
    const hhmm = parseCustomTimeToHHMM(customInput);
    if (!hhmm) {
      setCustomError("invalid — try 5:30pm or 17:30");
      return;
    }
    if (config.timeSlots.includes(hhmm)) {
      setCustomError("already added");
      return;
    }
    set("timeSlots", [...config.timeSlots, hhmm].sort());
    setCustomInput("");
  }

  function togglePreset(preset: TelegramDeadlinePreset) {
    const active = config.deadlinePresets.includes(preset);
    if (active && config.deadlinePresets.length === 1) return;
    const next = active
      ? config.deadlinePresets.filter((p) => p !== preset)
      : [...config.deadlinePresets, preset];
    set("deadlinePresets", next);
  }

  const customSlots = config.timeSlots.filter((s) => !STANDARD_SLOT_VALUES.has(s));

  return (
    <div className="flex flex-col gap-5">
      <div className="text-muted-foreground/50 font-mono text-[9px] leading-relaxed">
        configure how this bucket behaves in the telegram bot — set a shortcut alias, choose which
        deadline buttons appear, and whether to ask about recurring.
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-muted-foreground font-mono text-[10px]">alias</label>
        <input
          type="text"
          value={config.alias ?? ""}
          onChange={(e) =>
            set("alias", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") || null)
          }
          placeholder="e.g. todo, sub, work"
          disabled={disabled}
          maxLength={TELEGRAM_ALIAS_MAX_LENGTH}
          className="border-border focus:border-foreground w-full border-b bg-transparent py-1.5 font-mono text-xs outline-none placeholder:opacity-40 disabled:opacity-50"
        />
        <p className="text-muted-foreground/50 font-mono text-[9px]">
          {config.alias
            ? `type /${config.alias} title in telegram to skip the bucket picker`
            : "optional — lets you skip the bucket picker with a shortcut"}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-muted-foreground font-mono text-[10px]">deadline buttons</label>
        <p className="text-muted-foreground/50 font-mono text-[9px]">
          choose which options appear when adding an item to this bucket
        </p>
        <div className="flex flex-wrap gap-1.5">
          {TELEGRAM_DEADLINE_PRESETS.map(({ value, label }) => {
            const active = config.deadlinePresets.includes(value);
            const isLast = active && config.deadlinePresets.length === 1;
            return (
              <button
                key={value}
                onClick={() => togglePreset(value)}
                aria-pressed={active}
                disabled={disabled || isLast}
                title={isLast ? "at least one button required" : undefined}
                className={cn(
                  "border px-2 py-0.5 font-mono text-[10px] transition-colors disabled:cursor-not-allowed",
                  active
                    ? "bg-foreground text-background border-foreground"
                    : "text-muted-foreground border-border hover:text-foreground hover:border-foreground/50"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        <p className="text-muted-foreground/50 font-mono text-[9px]">
          {config.deadlinePresets.length} selected — buttons appear in the order above
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-muted-foreground font-mono text-[10px]">time buttons</label>
        <p className="text-muted-foreground/50 font-mono text-[9px]">
          choose which times appear in telegram — toggle hourly presets or add a custom time
        </p>
        <div className="flex flex-wrap gap-1.5">
          {TELEGRAM_TIME_SLOT_OPTIONS.map(({ value, label }) => {
            const active = config.timeSlots.includes(value);
            const isLast = active && config.timeSlots.length === 1;
            return (
              <button
                key={value}
                onClick={() => toggleStandardSlot(value)}
                aria-pressed={active}
                disabled={disabled || isLast}
                title={isLast ? "at least one time required" : undefined}
                className={cn(
                  "border px-2 py-0.5 font-mono text-[10px] transition-colors disabled:cursor-not-allowed",
                  active
                    ? "bg-foreground text-background border-foreground"
                    : "text-muted-foreground border-border hover:text-foreground hover:border-foreground/50"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        {customSlots.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {customSlots.map((hhmm) => (
              <span
                key={hhmm}
                className="bg-foreground text-background border-foreground flex items-center gap-1 border px-2 py-0.5 font-mono text-[10px]"
              >
                {formatSlot(hhmm)}
                <button
                  onClick={() => removeSlot(hhmm)}
                  aria-label={`remove ${formatSlot(hhmm)}`}
                  disabled={disabled || config.timeSlots.length === 1}
                  className="leading-none opacity-60 transition-opacity hover:opacity-100 disabled:cursor-not-allowed"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 pt-0.5">
          <input
            type="text"
            value={customInput}
            onChange={(e) => {
              setCustomInput(e.target.value);
              setCustomError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomSlot();
              }
            }}
            placeholder="e.g. 5:30pm or 17:30"
            disabled={disabled}
            className="border-border focus:border-foreground min-w-0 flex-1 border-b bg-transparent py-1 font-mono text-[10px] outline-none placeholder:opacity-30 disabled:opacity-50"
          />
          <button
            onClick={addCustomSlot}
            disabled={disabled || !customInput.trim()}
            className="text-muted-foreground border-border hover:text-foreground hover:border-foreground/50 border px-2 py-0.5 font-mono text-[10px] transition-colors disabled:opacity-30"
          >
            add
          </button>
        </div>
        {customError && <p className="text-destructive font-mono text-[9px]">{customError}</p>}
        <p className="text-muted-foreground/50 font-mono text-[9px]">
          {config.timeSlots.length} time{config.timeSlots.length === 1 ? "" : "s"} configured
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-muted-foreground font-mono text-[10px]">
            ask &quot;repeats?&quot;
          </label>
          <button
            onClick={() => set("showRecurring", !config.showRecurring)}
            aria-pressed={config.showRecurring}
            disabled={disabled}
            className={cn(
              "border px-2 py-0.5 font-mono text-[10px] transition-colors disabled:opacity-50",
              config.showRecurring
                ? "bg-foreground text-background border-foreground"
                : "text-muted-foreground border-border hover:text-foreground"
            )}
          >
            {config.showRecurring ? "on" : "off"}
          </button>
        </div>
        <p className="text-muted-foreground/50 font-mono text-[9px]">
          after picking a deadline, show a &quot;Repeats?&quot; step — good for subscriptions
        </p>

        {config.showRecurring && (
          <div className="flex flex-col gap-1.5 pt-1">
            <label className="text-muted-foreground font-mono text-[10px]">default selection</label>
            <div className="flex flex-wrap gap-1.5">
              {TELEGRAM_RECURRING_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => set("defaultRecurring", value as TelegramRecurringDefault)}
                  aria-pressed={config.defaultRecurring === value}
                  disabled={disabled}
                  className={cn(
                    "border px-2 py-0.5 font-mono text-[10px] transition-colors disabled:opacity-50",
                    config.defaultRecurring === value
                      ? "bg-foreground text-background border-foreground"
                      : "text-muted-foreground border-border hover:text-foreground hover:border-foreground/50"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-muted-foreground/50 font-mono text-[9px]">
              pre-selected in telegram — user can still pick any option
            </p>
          </div>
        )}
      </div>

      <button
        onClick={() => onChange(DEFAULT_TELEGRAM_BOT_CONFIG)}
        disabled={disabled}
        className="text-muted-foreground/40 hover:text-muted-foreground self-start font-mono text-[9px] underline decoration-dotted transition-colors disabled:opacity-50"
      >
        reset to defaults
      </button>
    </div>
  );
}

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
import type { TelegramBotConfig, TelegramDeadlinePreset } from "./constants";
import { HINT, INPUT, LABEL } from "@/components/layout/settings-constants";
import { BracketButton } from "@/components/ui/BracketButton";
import { OptionButton } from "@/components/ui/OptionButton";
import { OptionGroup } from "@/components/ui/OptionGroup";
import { Toggle } from "@/components/ui/Toggle";

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
      <div className={cn(HINT, "leading-relaxed")}>
        configure how this bucket behaves in the telegram bot — set a shortcut alias, choose which
        deadline buttons appear, and whether to ask about recurring.
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>alias</label>
        <input
          type="text"
          value={config.alias ?? ""}
          onChange={(e) =>
            set("alias", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") || null)
          }
          placeholder="e.g. todo, sub, work"
          disabled={disabled}
          maxLength={TELEGRAM_ALIAS_MAX_LENGTH}
          className={INPUT}
        />
        <p className={HINT}>
          {config.alias
            ? `type /${config.alias} title in telegram to skip the bucket picker`
            : "optional — lets you skip the bucket picker with a shortcut"}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className={LABEL}>deadline buttons</label>
        <p className={HINT}>choose which options appear when adding an item to this bucket</p>
        <div className="flex flex-wrap gap-1.5">
          {TELEGRAM_DEADLINE_PRESETS.map(({ value, label }) => {
            const active = config.deadlinePresets.includes(value);
            const isLast = active && config.deadlinePresets.length === 1;
            return (
              <OptionButton
                key={value}
                active={active}
                onClick={() => togglePreset(value)}
                disabled={disabled || isLast}
                title={isLast ? "at least one button required" : undefined}
              >
                {label}
              </OptionButton>
            );
          })}
        </div>
        <p className={HINT}>
          {config.deadlinePresets.length} selected — buttons appear in the order above
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className={LABEL}>time buttons</label>
        <p className={HINT}>
          choose which times appear in telegram — toggle hourly presets or add a custom time
        </p>
        <div className="flex flex-wrap gap-1.5">
          {TELEGRAM_TIME_SLOT_OPTIONS.map(({ value, label }) => {
            const active = config.timeSlots.includes(value);
            const isLast = active && config.timeSlots.length === 1;
            return (
              <OptionButton
                key={value}
                active={active}
                onClick={() => toggleStandardSlot(value)}
                disabled={disabled || isLast}
                title={isLast ? "at least one time required" : undefined}
              >
                {label}
              </OptionButton>
            );
          })}
        </div>

        {customSlots.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {customSlots.map((hhmm) => (
              <OptionButton
                key={hhmm}
                onClick={() => removeSlot(hhmm)}
                aria-label={`remove ${formatSlot(hhmm)}`}
                disabled={disabled || config.timeSlots.length === 1}
              >
                {formatSlot(hhmm)}
                <span data-remove> ×</span>
              </OptionButton>
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
            className={cn(INPUT, "min-w-0 flex-1")}
          />
          <BracketButton
            onClick={addCustomSlot}
            disabled={disabled || !customInput.trim()}
            aria-label="add time"
            className="px-1"
          >
            + add
          </BracketButton>
        </div>
        {customError && <p className="text-destructive font-mono text-[11px]">{customError}</p>}
        <p className={HINT}>
          {config.timeSlots.length} time{config.timeSlots.length === 1 ? "" : "s"} configured
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className={LABEL}>ask &quot;repeats?&quot;</label>
        <p className={HINT}>
          after picking a deadline, show a &quot;Repeats?&quot; step — good for subscriptions
        </p>
        <Toggle
          value={config.showRecurring}
          onChange={(value) => set("showRecurring", value)}
          disabled={disabled}
        />

        {config.showRecurring && (
          <div className="flex flex-col gap-1.5 pt-1">
            <label className={LABEL}>default selection</label>
            <OptionGroup
              options={TELEGRAM_RECURRING_OPTIONS}
              value={config.defaultRecurring}
              onChange={(value) => set("defaultRecurring", value)}
              disabled={disabled}
            />
            <p className={HINT}>pre-selected in telegram — user can still pick any option</p>
          </div>
        )}
      </div>

      <BracketButton
        onClick={() => onChange(DEFAULT_TELEGRAM_BOT_CONFIG)}
        disabled={disabled}
        variant="warning"
        className="self-start px-1"
      >
        reset to defaults
      </BracketButton>
    </div>
  );
}

import { useState } from "react";
import { DatePicker } from "@/components/ui/DatePicker";
import { OptionButton } from "@/components/ui/OptionButton";
import { Toggle } from "@/components/ui/Toggle";
import { LAST_DAY_OF_MONTH, WEEKDAY_NAMES, WORK_WEEK } from "@/constants";
import { describeRepeat } from "@/lib/items/repeat-label";
import { RECURRING_FREQUENCIES } from "./constants";
import type { RecurringConfig } from "@/types/rules";

const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];
const LABEL = "text-muted-foreground font-mono text-xs";

function toggleDay(config: RecurringConfig, day: number): RecurringConfig {
  const current = config.weekdays ?? [];
  const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
  return { ...config, weekdays: next.length > 0 ? next : undefined };
}

type RecurringPickerProps = {
  recurring: RecurringConfig | null | undefined;
  deadlineDay?: number;
  initialShowEndDate?: boolean;
  disabled?: boolean;
  onChange: (v: RecurringConfig | null) => void;
};

export function RecurringPicker({
  recurring,
  deadlineDay,
  initialShowEndDate = false,
  disabled,
  onChange,
}: RecurringPickerProps) {
  const [showEndDate, setShowEndDate] = useState(initialShowEndDate);
  const [intervalStr, setIntervalStr] = useState(String(recurring?.interval ?? 1));

  function toggle(on: boolean) {
    if (on === !!recurring?.enabled) return;
    onChange(on ? { enabled: true, frequency: "monthly", interval: 1, endDate: null } : null);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-muted-foreground font-mono text-xs">↺ repeats</label>
        <Toggle value={!!recurring?.enabled} onChange={toggle} disabled={disabled} />
      </div>

      {recurring?.enabled && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground font-mono text-xs">every</span>
            <input
              type="text"
              inputMode="numeric"
              value={intervalStr}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9]/g, "");
                setIntervalStr(raw);
                const val = parseInt(raw, 10);
                if (Number.isFinite(val) && val > 0) {
                  onChange({ ...recurring, interval: val });
                }
              }}
              onBlur={() => {
                const val = parseInt(intervalStr, 10);
                if (!Number.isFinite(val) || val < 1) {
                  setIntervalStr(String(recurring.interval));
                }
              }}
              disabled={disabled}
              className="border-border w-10 border-b bg-transparent py-0.5 text-center font-mono text-xs outline-none disabled:opacity-50"
            />
            <div className="flex flex-wrap gap-1">
              {RECURRING_FREQUENCIES.map((f) => (
                <OptionButton
                  key={f.value}
                  active={recurring.frequency === f.value}
                  onClick={() =>
                    onChange({
                      ...recurring,
                      frequency: f.value,
                      weekdays: undefined,
                      anchorDay: undefined,
                    })
                  }
                  disabled={disabled}
                >
                  {f.label}
                </OptionButton>
              ))}
            </div>
          </div>
          {recurring.frequency === "weekly" && (
            <div className="flex flex-wrap items-center gap-1">
              <span className={`${LABEL} pr-1`}>on</span>
              {MONDAY_FIRST.map((day) => (
                <OptionButton
                  key={day}
                  active={recurring.weekdays?.includes(day) ?? false}
                  onClick={() => onChange(toggleDay(recurring, day))}
                  disabled={disabled}
                >
                  {WEEKDAY_NAMES[day]}
                </OptionButton>
              ))}
              <OptionButton
                onClick={() => onChange({ ...recurring, weekdays: WORK_WEEK })}
                disabled={disabled}
              >
                weekdays
              </OptionButton>
            </div>
          )}
          {recurring.frequency === "monthly" && (
            <div className="flex flex-wrap items-center gap-1">
              <span className={`${LABEL} pr-1`}>on</span>
              <OptionButton
                active={recurring.anchorDay !== LAST_DAY_OF_MONTH}
                onClick={() => onChange({ ...recurring, anchorDay: deadlineDay || undefined })}
                disabled={disabled}
              >
                same day
              </OptionButton>
              <OptionButton
                active={recurring.anchorDay === LAST_DAY_OF_MONTH}
                onClick={() => onChange({ ...recurring, anchorDay: LAST_DAY_OF_MONTH })}
                disabled={disabled}
              >
                last day
              </OptionButton>
            </div>
          )}
          <p className={LABEL}>
            ↺ {describeRepeat(recurring)}
            {recurring.frequency === "weekly" && !recurring.weekdays && " · on the deadline's day"}
          </p>
          {showEndDate ? (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-mono text-xs">ends</span>
              <DatePicker
                value={recurring.endDate ?? ""}
                onChange={(v) => onChange({ ...recurring, endDate: v || null })}
                disabled={disabled}
              />
              <button
                onClick={() => {
                  setShowEndDate(false);
                  onChange({ ...recurring, endDate: null });
                }}
                className="text-muted-foreground hover:text-foreground font-mono text-xs transition-colors"
              >
                ×
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowEndDate(true)}
              className="text-muted-foreground hover:text-foreground w-fit font-mono text-xs transition-colors"
            >
              + set end date
            </button>
          )}
        </div>
      )}
    </div>
  );
}

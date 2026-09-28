import { useState } from "react";
import { DatePicker } from "@/components/ui/DatePicker";
import { OptionButton } from "@/components/ui/OptionButton";
import { RECURRING_FREQUENCIES } from "./constants";
import type { RecurringConfig } from "@/types/rules";

function describeRecurring(config: RecurringConfig): string {
  const freq = RECURRING_FREQUENCIES.find((f) => f.value === config.frequency);
  const unit = freq?.label ?? config.frequency;
  const n = config.interval;
  const unitStr = n === 1 ? unit : `${unit}s`;
  return n === 1 ? `every ${unitStr}` : `every ${n} ${unitStr}`;
}

type RecurringPickerProps = {
  recurring: RecurringConfig | null | undefined;
  initialShowEndDate?: boolean;
  disabled?: boolean;
  onChange: (v: RecurringConfig | null) => void;
};

export function RecurringPicker({
  recurring,
  initialShowEndDate = false,
  disabled,
  onChange,
}: RecurringPickerProps) {
  const [showEndDate, setShowEndDate] = useState(initialShowEndDate);
  const [intervalStr, setIntervalStr] = useState(String(recurring?.interval ?? 1));

  function toggle() {
    if (recurring?.enabled) {
      onChange(null);
    } else {
      onChange({ enabled: true, frequency: "monthly", interval: 1, endDate: null });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-muted-foreground font-mono text-[10px]">↺ repeats</label>
        <button
          onClick={toggle}
          disabled={disabled}
          className={`font-mono text-[10px] transition-colors disabled:opacity-50 ${
            recurring?.enabled ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          [{recurring?.enabled ? "on" : "off"}]
        </button>
      </div>

      {recurring?.enabled && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground font-mono text-[10px]">every</span>
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
                  onClick={() => onChange({ ...recurring, frequency: f.value })}
                  disabled={disabled}
                >
                  {f.label}
                </OptionButton>
              ))}
            </div>
          </div>
          <p className="text-muted-foreground font-mono text-[10px]">
            ↺ {describeRecurring(recurring)}
          </p>
          {showEndDate ? (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-mono text-[10px]">ends</span>
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
                className="text-muted-foreground hover:text-foreground font-mono text-[10px] transition-colors"
              >
                ×
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowEndDate(true)}
              className="text-muted-foreground hover:text-foreground w-fit font-mono text-[10px] transition-colors"
            >
              + set end date
            </button>
          )}
        </div>
      )}
    </div>
  );
}

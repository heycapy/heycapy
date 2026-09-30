import { useState } from "react";
import { BracketButton } from "@/components/ui/BracketButton";
import { OptionButton } from "@/components/ui/OptionButton";
import { describeReminder } from "@/lib/items/reminder-label";
import { MAX_REMINDER_OFFSET_MINS, MAX_REMINDERS_PER_ITEM } from "@/lib/reminders/constants";
import { CUSTOM_REMINDER_UNITS, REMINDER_PRESETS } from "./constants";

const LABEL = "text-muted-foreground font-mono text-xs";

type ReminderPickerProps = {
  // null follows the bucket's default
  reminders: number[] | null;
  bucketDefault: number[];
  allDay: boolean;
  disabled?: boolean;
  onChange: (v: number[]) => void;
};

export function ReminderPicker({
  reminders,
  bucketDefault,
  allDay,
  disabled,
  onChange,
}: ReminderPickerProps) {
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState("");
  const [unitMins, setUnitMins] = useState<number>(60);
  const [customError, setCustomError] = useState("");

  const current = reminders ?? bucketDefault;
  const full = current.length >= MAX_REMINDERS_PER_ITEM;
  const presets = REMINDER_PRESETS.filter((m) => !current.includes(m));

  function add(mins: number) {
    onChange([...new Set([...current, mins])].sort((a, b) => b - a));
    closeAdding();
  }

  function closeAdding() {
    setAdding(false);
    setAmount("");
    setCustomError("");
  }

  function addCustom() {
    const n = parseInt(amount, 10);
    if (!Number.isFinite(n) || n < 1) {
      setCustomError("enter a number");
      return;
    }
    const mins = n * unitMins;
    if (mins > MAX_REMINDER_OFFSET_MINS) {
      setCustomError(`up to ${MAX_REMINDER_OFFSET_MINS / (24 * 60)} days before`);
      return;
    }
    add(mins);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className={LABEL}>reminders</label>
        <span className={LABEL}>
          {reminders === null && "bucket default · "}
          {current.length} of {MAX_REMINDERS_PER_ITEM}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {current.map((mins) => {
          const label = describeReminder(mins, allDay);
          return (
            <OptionButton
              key={mins}
              onClick={() => onChange(current.filter((m) => m !== mins))}
              disabled={disabled}
              aria-label={`remove reminder ${label}`}
            >
              {label} ×
            </OptionButton>
          );
        })}
        {current.length === 0 && <span className={LABEL}>none</span>}
        {!full && !adding && (
          <BracketButton onClick={() => setAdding(true)} disabled={disabled} className="px-1">
            + add
          </BracketButton>
        )}
      </div>
      {full && <p className={LABEL}>that&apos;s the max — remove one to add another</p>}

      {adding && (
        <div className="border-border flex flex-col gap-2 border-l-2 pl-3">
          {presets.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {presets.map((mins) => (
                <OptionButton key={mins} onClick={() => add(mins)} disabled={disabled}>
                  {describeReminder(mins, allDay)}
                </OptionButton>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value.replace(/[^0-9]/g, ""));
                setCustomError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustom();
                }
              }}
              aria-label="custom reminder amount"
              placeholder="3"
              disabled={disabled}
              className="border-border focus:border-foreground placeholder:text-muted-foreground/50 w-10 border-b bg-transparent py-0.5 text-center font-mono text-base outline-none disabled:opacity-50 sm:text-xs"
            />
            <div role="group" aria-label="custom reminder unit" className="flex gap-1">
              {CUSTOM_REMINDER_UNITS.map((u) => (
                <OptionButton
                  key={u.mins}
                  active={unitMins === u.mins}
                  onClick={() => setUnitMins(u.mins)}
                  disabled={disabled}
                >
                  {u.name === "min" ? "min" : `${u.name}s`}
                </OptionButton>
              ))}
            </div>
            <span className={`${LABEL} pl-0.5`}>before</span>
          </div>
          <div className="flex items-center gap-3">
            <BracketButton
              onClick={addCustom}
              disabled={disabled}
              aria-label="add custom reminder"
              className="px-1"
            >
              add
            </BracketButton>
            <BracketButton onClick={closeAdding} disabled={disabled} className="px-1">
              cancel
            </BracketButton>
          </div>
          {customError && <p className="text-destructive font-mono text-[11px]">{customError}</p>}
        </div>
      )}
    </div>
  );
}

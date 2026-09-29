import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Clock } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatTypedTime, parseTimeInput } from "@/lib/time-input";
import { BracketButton } from "./BracketButton";
import { usePopover } from "./usePopover";

export type Ampm = "am" | "pm";

const HOURS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const QUARTERS = ["00", "15", "30", "45"];
const PANEL = { width: 252, height: 272 };
const LABEL = "text-muted-foreground font-mono text-[11px]";

export type TimeValue = { hour: string; min: string; ampm: Ampm };

type TimeFieldProps = {
  value: TimeValue;
  onChange: (value: TimeValue) => void;
  disabled?: boolean;
};

function Cell({
  selected,
  onClick,
  children,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={label}
      className={cn(
        "flex h-8 items-center justify-center font-mono text-xs transition-colors",
        selected ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
      )}
    >
      {children}
    </button>
  );
}

export function TimeField({ value, onChange, disabled }: TimeFieldProps) {
  const { hour, min, ampm } = value;
  const { open, setOpen, toggle, pos, mounted, triggerRef, popoverRef } = usePopover(PANEL);
  const [typed, setTyped] = useState("");
  const [typedInvalid, setTypedInvalid] = useState(false);
  const minutes = QUARTERS.includes(min) ? QUARTERS : [...QUARTERS, min].sort();
  const display = min === "00" ? `${hour} ${ampm}` : `${hour}:${min} ${ampm}`;

  function applyTyped() {
    const parsed = parseTimeInput(typed);
    if (!parsed) {
      setTypedInvalid(parsed === null);
      return;
    }
    const [h24, m] = parsed.split(":").map(Number) as [number, number];
    const typedHour = parseInt(typed, 10);
    // "4:30" with no am/pm keeps whichever is selected; 13–23 and 0 are read as 24-hour times
    const keepMeridiem = !/[ap]/i.test(typed) && typedHour >= 1 && typedHour <= 12;
    onChange({
      hour: String(h24 % 12 === 0 ? 12 : h24 % 12),
      min: String(m).padStart(2, "0"),
      ampm: keepMeridiem ? ampm : h24 >= 12 ? "pm" : "am",
    });
    setTyped("");
    setTypedInvalid(false);
    setOpen(false);
  }

  const panel = (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={popoverRef}
          role="dialog"
          aria-label="pick a time"
          initial={{ opacity: 0, y: -4, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.97 }}
          transition={{ duration: 0.12 }}
          style={{ top: pos.top, left: pos.left, width: PANEL.width }}
          className="border-border bg-card fixed z-[65] flex flex-col gap-2.5 border-2 p-3 shadow-[3px_3px_0_var(--border)] select-none"
        >
          <div role="group" aria-label="hour" className="flex flex-col gap-1">
            <span className={LABEL}>hour</span>
            <div className="grid grid-cols-6 gap-0.5">
              {HOURS.map((h) => (
                <Cell key={h} selected={h === hour} onClick={() => onChange({ ...value, hour: h })}>
                  {h}
                </Cell>
              ))}
            </div>
          </div>
          <div role="group" aria-label="minute" className="flex flex-col gap-1">
            <span className={LABEL}>minute</span>
            <div
              className="grid gap-0.5"
              style={{ gridTemplateColumns: `repeat(${minutes.length}, 1fr)` }}
            >
              {minutes.map((m) => (
                <Cell
                  key={m}
                  selected={m === min}
                  onClick={() => onChange({ ...value, min: m })}
                  label={`:${m}`}
                >
                  :{m}
                </Cell>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-0.5">
            {(["am", "pm"] as const).map((a) => (
              <Cell key={a} selected={a === ampm} onClick={() => onChange({ ...value, ampm: a })}>
                {a}
              </Cell>
            ))}
          </div>
          <div className="border-border flex items-center gap-2 border-t pt-2.5">
            <input
              value={typed}
              onChange={(e) => {
                const next = e.target.value;
                // Deleting is left alone, so a backspace never gets refilled
                setTyped(next.length < typed.length ? next : formatTypedTime(next));
                setTypedInvalid(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyTyped();
                }
              }}
              placeholder="or type: 937p"
              aria-label="type a time"
              className={cn(
                "placeholder:text-muted-foreground/70 min-w-0 flex-1 border-b bg-transparent py-1 font-mono text-xs outline-none",
                typedInvalid
                  ? "border-destructive text-destructive"
                  : "border-border focus:border-foreground"
              )}
            />
            <BracketButton
              onClick={() => (typed.trim() ? applyTyped() : setOpen(false))}
              className="shrink-0 py-1"
            >
              done
            </BracketButton>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && toggle()}
        disabled={disabled}
        aria-label={`time: ${display}`}
        className="border-foreground text-foreground flex items-center gap-2 border-b py-1.5 font-mono text-sm transition-all active:translate-y-[1px] disabled:opacity-50"
      >
        <span>{display}</span>
        <Clock size={13} className="opacity-60" aria-hidden />
      </button>
      {mounted && createPortal(panel, document.body)}
    </div>
  );
}

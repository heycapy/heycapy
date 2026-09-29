import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { usePopover } from "./usePopover";

type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAYS_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const CALENDAR = { width: 252, height: 300 };

function parseDate(str: string): { year: number; month: number; day: number } | null {
  if (!str) return null;
  const parts = str.split("-").map(Number);
  if (parts.length !== 3) return null;
  return { year: parts[0] ?? 0, month: (parts[1] ?? 1) - 1, day: parts[2] ?? 1 };
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDisplay(str: string): string {
  const parsed = parseDate(str);
  if (!parsed) return "";
  return `${MONTHS[parsed.month]?.slice(0, 3)} ${parsed.day}`;
}

export function DatePicker({ value, onChange, disabled }: DatePickerProps) {
  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const parsed = parseDate(value);
  const [viewYear, setViewYear] = useState(parsed?.year ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? today.getMonth());
  const { open, setOpen, toggle, pos, portalTarget, triggerRef, popoverRef } = usePopover(CALENDAR);

  useEffect(() => {
    const p = parseDate(value);
    if (!p) return;
    const id = setTimeout(() => {
      setViewYear(p.year);
      setViewMonth(p.month);
    }, 0);
    return () => clearTimeout(id);
  }, [value]);

  function shiftMonth(by: 1 | -1) {
    const index = viewYear * 12 + viewMonth + by;
    setViewYear(Math.floor(index / 12));
    setViewMonth(((index % 12) + 12) % 12);
  }

  function selectDay(day: number) {
    onChange(toDateStr(viewYear, viewMonth, day));
    setOpen(false);
  }

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();

  const panel = (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={popoverRef}
          initial={{ opacity: 0, y: -4, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.97 }}
          transition={{ duration: 0.12 }}
          style={{ top: pos.top, left: pos.left, width: CALENDAR.width }}
          className="border-border bg-card fixed z-[65] border-2 p-3 shadow-[3px_3px_0_var(--border)] select-none"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="previous month"
              className="text-muted-foreground hover:text-foreground p-1.5 transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="font-pixel text-xs">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="next month"
              className="text-muted-foreground hover:text-foreground p-1.5 transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7">
            {DAYS_SHORT.map((d) => (
              <span
                key={d}
                className="text-muted-foreground py-1 text-center font-mono text-[11px]"
              >
                {d}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-0.5">
            {Array.from({ length: firstDay }, (_, i) => (
              <span key={`pad-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const dayStr = toDateStr(viewYear, viewMonth, day);
              const isSelected = dayStr === value;
              const isToday = dayStr === todayStr;
              return (
                <button
                  type="button"
                  key={day}
                  onClick={() => selectDay(day)}
                  className={cn(
                    "mx-auto flex h-8 w-8 items-center justify-center font-mono text-xs transition-colors",
                    isSelected && "bg-primary text-primary-foreground",
                    !isSelected && isToday && "border-border text-foreground border font-bold",
                    !isSelected && !isToday && "text-foreground hover:bg-muted"
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {value && (
            <div className="border-border mt-3 flex items-center justify-between border-t pt-2.5">
              <span className="text-muted-foreground font-mono text-xs">
                {formatDisplay(value)}
              </span>
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="text-muted-foreground hover:text-destructive flex items-center gap-1 py-1 font-mono text-xs transition-colors"
              >
                <X size={11} /> clear
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="w-full">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && toggle()}
        disabled={disabled}
        className={cn(
          "flex w-full items-center justify-between gap-2 border-b py-1.5 font-mono text-sm transition-all active:translate-y-[1px] disabled:opacity-50",
          value
            ? "border-foreground text-foreground"
            : "border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground"
        )}
      >
        <span>{value ? formatDisplay(value) : "pick date"}</span>
        <CalendarDays size={13} className="opacity-60" aria-hidden />
      </button>
      {portalTarget && createPortal(panel, portalTarget)}
    </div>
  );
}

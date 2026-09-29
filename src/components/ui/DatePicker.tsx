import { createPortal } from "react-dom";
import { CalendarDays, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { MONTH_SHORT_NAMES } from "@/constants";
import { usePopover } from "./usePopover";
import { Calendar, parseDate } from "./Calendar";

type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

const CALENDAR = { width: 252, height: 300 };

function formatDisplay(str: string): string {
  const parsed = parseDate(str);
  if (!parsed) return "";
  return `${MONTH_SHORT_NAMES[parsed.month]} ${parsed.day}`;
}

export function DatePicker({ value, onChange, disabled }: DatePickerProps) {
  const { open, setOpen, toggle, pos, portalTarget, triggerRef, popoverRef } = usePopover(CALENDAR);

  function selectDay(date: string) {
    onChange(date);
    setOpen(false);
  }

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
          <Calendar value={value} onSelect={selectDay} />

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

import { OptionButton } from "./OptionButton";
import { Icon } from "@/components/ui/Icon";
import { createPortal } from "react-dom";
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

export function formatDisplay(str: string): string {
  const parsed = parseDate(str);
  if (!parsed) return "";
  return `${MONTH_SHORT_NAMES[parsed.month]} ${parsed.day}`;
}

export function DatePicker({ value, onChange, disabled }: DatePickerProps) {
  const { open, setOpen, toggle, pos, positioning, portalTarget, triggerRef, popoverRef } =
    usePopover(CALENDAR);

  function selectDay(date: string) {
    onChange(date);
    setOpen(false);
  }

  const panel = (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={popoverRef}
          data-popover
          initial={{ opacity: 0, y: -4, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.97 }}
          transition={{ duration: 0.12 }}
          style={{ top: pos.top, left: pos.left, width: CALENDAR.width }}
          className={cn(
            positioning,
            "border-border bg-card rounded-panel border-frame shadow-raised z-[65] p-3 select-none"
          )}
        >
          <Calendar value={value} onSelect={selectDay} />

          {value && (
            <div className="border-border mt-3 flex items-center justify-between border-t pt-2.5">
              <span className="text-muted-foreground font-ui text-xs">{formatDisplay(value)}</span>
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="text-muted-foreground hover:text-destructive font-ui flex items-center gap-1 py-1 text-xs transition-colors"
              >
                <Icon name="close" /> clear
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div>
      <OptionButton
        ref={triggerRef}
        active={open}
        aria-pressed={undefined}
        aria-expanded={open}
        onClick={() => !disabled && toggle()}
        disabled={disabled}
        className={cn("inline-flex items-center gap-1.5", value && !open && "text-foreground")}
      >
        <Icon name="calendar" className="shrink-0" />
        <span>{value ? formatDisplay(value) : "pick date"}</span>
      </OptionButton>
      {portalTarget && createPortal(panel, portalTarget)}
    </div>
  );
}

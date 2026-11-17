"use client";

import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar } from "@/components/ui/Calendar";
import { formatDisplay } from "@/components/ui/DatePicker";
import { OptionButton } from "@/components/ui/OptionButton";
import { usePopover } from "@/components/ui/usePopover";
import { dateShortcuts } from "@/lib/items/edit-draft";
import { cn } from "@/lib/utils";
import { DetailChip } from "./DetailChip";

const PANEL = { width: 252, height: 352 };

type ItemDateChipProps = {
  value: string;
  zone: string;
  onChange: (date: string) => void;
};

export function ItemDateChip({ value, zone, onChange }: ItemDateChipProps) {
  const { open, setOpen, toggle, pos, positioning, portalTarget, triggerRef, popoverRef } =
    usePopover(PANEL);

  function pick(date: string) {
    onChange(date);
    setOpen(false);
  }

  const panel = (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={popoverRef}
          data-popover
          role="dialog"
          aria-label="pick a date"
          initial={{ opacity: 0, y: -4, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.97 }}
          transition={{ duration: 0.12 }}
          style={{ top: pos.top, left: pos.left, width: PANEL.width }}
          className={cn(
            positioning,
            "border-border bg-card rounded-panel border-frame shadow-raised z-[65] flex flex-col gap-3 p-3 select-none"
          )}
        >
          <div className="flex flex-wrap gap-1.5">
            {dateShortcuts(new Date(), zone).map((shortcut) => (
              <OptionButton
                pill
                key={shortcut.label}
                active={shortcut.value === value}
                onClick={() => pick(shortcut.value)}
              >
                {shortcut.label}
              </OptionButton>
            ))}
            {value && (
              <OptionButton pill onClick={() => pick("")}>
                no date
              </OptionButton>
            )}
          </div>
          <Calendar value={value} onSelect={pick} />
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <DetailChip
        ref={triggerRef}
        name="date"
        icon="calendar"
        label={value ? formatDisplay(value) : "date"}
        set={value !== ""}
        open={open}
        onClick={toggle}
      />
      {portalTarget && createPortal(panel, portalTarget)}
    </>
  );
}

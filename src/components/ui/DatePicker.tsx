"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

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

function parseDate(str: string): { year: number; month: number; day: number } | null {
  if (!str) return null;
  const parts = str.split("-").map(Number);
  if (parts.length !== 3) return null;
  return { year: parts[0], month: parts[1] - 1, day: parts[2] };
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDisplay(str: string): string {
  const parsed = parseDate(str);
  if (!parsed) return "";
  return `${MONTHS[parsed.month].slice(0, 3)} ${parsed.day}`;
}

export function DatePicker({ value, onChange, disabled }: DatePickerProps) {
  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const parsed = parseDate(value);
  const [viewYear, setViewYear] = useState(parsed?.year ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? today.getMonth());
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!value) return;
    const p = parseDate(value);
    if (!p) return;
    const id = setTimeout(() => {
      setViewYear(p.year);
      setViewMonth(p.month);
    }, 0);
    return () => clearTimeout(id);
  }, [value]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      if (
        popoverRef.current?.contains(e.target as Node) ||
        triggerRef.current?.contains(e.target as Node)
      )
        return;
      setOpen(false);
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function openPicker() {
    if (disabled) return;
    if (open) {
      setOpen(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const calW = 236;
    const calH = 260;
    let left = rect.left;
    let top = rect.bottom + 6;

    if (left + calW > window.innerWidth - 8) left = window.innerWidth - calW - 8;
    if (top + calH > window.innerHeight - 8) top = rect.top - calH - 6;

    setPos({ top, left });
    setOpen(true);
  }

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function selectDay(day: number) {
    onChange(toDateStr(viewYear, viewMonth, day));
    setOpen(false);
  }

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();

  const popover = (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={popoverRef}
          initial={{ opacity: 0, y: -4, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.97 }}
          transition={{ duration: 0.12 }}
          style={{
            top: pos.top,
            left: pos.left,
            boxShadow: "3px 3px 0 var(--border)",
          }}
          className="border-border bg-card fixed z-[65] w-[236px] border-2 p-3 select-none"
        >
          <div className="mb-3 flex items-center justify-between">
            <button
              onClick={prevMonth}
              className="text-muted-foreground hover:text-foreground p-0.5 transition-colors"
            >
              <ChevronLeft size={13} />
            </button>
            <span className="font-pixel text-[11px]">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              onClick={nextMonth}
              className="text-muted-foreground hover:text-foreground p-0.5 transition-colors"
            >
              <ChevronRight size={13} />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7">
            {DAYS_SHORT.map((d) => (
              <span
                key={d}
                className="text-muted-foreground py-1 text-center font-mono text-[10px]"
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
                  key={day}
                  onClick={() => selectDay(day)}
                  className={cn(
                    "mx-auto flex h-7 w-7 items-center justify-center font-mono text-xs transition-colors",
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
              <span className="text-muted-foreground font-mono text-[11px]">
                {formatDisplay(value)}
              </span>
              <button
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="text-muted-foreground hover:text-destructive flex items-center gap-1 font-mono text-[10px] transition-colors"
              >
                <X size={10} /> clear
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
        onClick={openPicker}
        disabled={disabled}
        className={cn(
          "flex w-full items-center justify-between border-b py-1 font-mono text-xs transition-all active:translate-y-[1px] disabled:opacity-50",
          value
            ? "border-foreground text-foreground"
            : "border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground"
        )}
      >
        <span>{value ? formatDisplay(value) : "pick date"}</span>
        <CalendarDays size={11} className="opacity-50" />
      </button>
      {mounted && createPortal(popover, document.body)}
    </div>
  );
}

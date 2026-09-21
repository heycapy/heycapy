"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

function parseTime(str: string): { hour: number; minute: number } | null {
  if (!str) return null;
  const parts = str.split(":").map(Number);
  if (parts.length < 2) return null;
  const [h, m] = parts;
  if (isNaN(h) || isNaN(m)) return null;
  return { hour: h, minute: m };
}

function toTimeStr(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatDisplay(str: string): string {
  const parsed = parseTime(str);
  if (!parsed) return "";
  return toTimeStr(parsed.hour, parsed.minute);
}

export function TimePicker({ value, onChange, disabled }: TimePickerProps) {
  const parsed = parseTime(value);
  const [hour, setHour] = useState(parsed?.hour ?? 9);
  const [minute, setMinute] = useState(parsed?.minute ?? 0);
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
    const p = parseTime(value);
    if (!p) return;
    const id = setTimeout(() => {
      setHour(p.hour);
      setMinute(p.minute);
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
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const popW = 160;
    const popH = 120;
    let left = rect.left;
    let top = rect.bottom + 6;

    if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
    if (top + popH > window.innerHeight - 8) top = rect.top - popH - 6;

    setPos({ top, left });
    setOpen(true);
  }

  function adjustHour(delta: number) {
    const next = (hour + delta + 24) % 24;
    setHour(next);
    onChange(toTimeStr(next, minute));
  }

  function adjustMinute(delta: number) {
    const next = (minute + delta + 60) % 60;
    setMinute(next);
    onChange(toTimeStr(hour, next));
  }

  const spinBtn = cn(
    "text-muted-foreground hover:text-foreground font-mono text-[10px] transition-colors px-2 py-0.5"
  );

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
          className="border-border bg-card fixed z-50 w-[160px] border-2 p-3 select-none"
        >
          <div className="flex items-center justify-center gap-4">
            <div className="flex flex-col items-center">
              <button type="button" onClick={() => adjustHour(1)} className={spinBtn}>
                ▲
              </button>
              <span className="font-pixel text-sm tabular-nums">
                {String(hour).padStart(2, "0")}
              </span>
              <button type="button" onClick={() => adjustHour(-1)} className={spinBtn}>
                ▼
              </button>
              <span className="text-muted-foreground mt-0.5 font-mono text-[9px]">hour</span>
            </div>

            <span className="font-pixel pb-4 text-sm">:</span>

            <div className="flex flex-col items-center">
              <button type="button" onClick={() => adjustMinute(5)} className={spinBtn}>
                ▲
              </button>
              <span className="font-pixel text-sm tabular-nums">
                {String(minute).padStart(2, "0")}
              </span>
              <button type="button" onClick={() => adjustMinute(-5)} className={spinBtn}>
                ▼
              </button>
              <span className="text-muted-foreground mt-0.5 font-mono text-[9px]">min</span>
            </div>
          </div>

          {value && (
            <div className="border-border mt-3 flex justify-end border-t pt-2">
              <button
                type="button"
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
        <span>{value ? formatDisplay(value) : "pick time"}</span>
        <Clock size={11} className="opacity-50" />
      </button>
      {mounted && createPortal(popover, document.body)}
    </div>
  );
}

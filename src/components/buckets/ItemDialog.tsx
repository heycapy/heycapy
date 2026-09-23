"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2 } from "lucide-react";
import { DatePicker } from "@/components/ui/DatePicker";
import { BracketButton } from "@/components/ui/BracketButton";
import { OptionButton } from "@/components/ui/OptionButton";
import { TimeScrollPicker, type Ampm } from "@/components/ui/TimeScrollPicker";
import { RECURRING_FREQUENCIES } from "./constants";
import type { RecurringConfig, StatusDef } from "@/types/rules";
import { cn } from "@/lib/utils";
import { useScrollLock } from "@/hooks/useScrollLock";

function describeRecurring(config: RecurringConfig): string {
  const freq = RECURRING_FREQUENCIES.find((f) => f.value === config.frequency);
  const unit = freq?.label ?? config.frequency;
  const n = config.interval;
  const unitStr = n === 1 ? unit : `${unit}s`;
  return n === 1 ? `every ${unitStr}` : `every ${n} ${unitStr}`;
}

function toH24(h12: number, ampm: "am" | "pm"): number {
  if (ampm === "am") return h12 === 12 ? 0 : h12;
  return h12 === 12 ? 12 : h12 + 12;
}

function buildDeadline(date: string, hour: string, min: string, ampm: "am" | "pm"): string {
  if (!date) return "";
  const h = parseInt(hour, 10);
  if (!hour.trim() || !Number.isFinite(h)) return date;
  const local = `${date}T${String(toH24(h, ampm)).padStart(2, "0")}:${min.padStart(2, "0")}:00`;
  const d = new Date(local);
  return isNaN(d.getTime()) ? date : d.toISOString();
}

interface ItemDialogProps {
  open: boolean;
  mode: "add" | "edit";
  title: string;
  deadline: string;
  status: string;
  statuses: StatusDef[];
  recurring?: RecurringConfig | null;
  error?: string;
  pending?: boolean;
  onTitleChange: (v: string) => void;
  onDeadlineChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onRecurringChange?: (v: RecurringConfig | null) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export function ItemDialog({
  open,
  mode,
  title,
  deadline,
  status,
  statuses,
  recurring,
  error,
  pending,
  onTitleChange,
  onDeadlineChange,
  onStatusChange,
  onRecurringChange,
  onConfirm,
  onCancel,
  onDelete,
}: ItemDialogProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useScrollLock(open);
  const [timeHour, setTimeHour] = useState("9");
  const [timeMin, setTimeMin] = useState("00");
  const [timeAmpm, setTimeAmpm] = useState<Ampm>("am");
  const [showEndDate, setShowEndDate] = useState(false);

  const wasOpenRef = useRef(false);

  const datePart = deadline.includes("T")
    ? (() => {
        const d = new Date(deadline);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      })()
    : deadline;
  const hasDate = datePart.length > 0;

  useEffect(() => {
    const didJustOpen = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (!didJustOpen) return;
    const id = setTimeout(() => {
      const el = textareaRef.current;
      if (el) {
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
        el.focus();
      }
      if (deadline.includes("T")) {
        const d = new Date(deadline);
        const h24 = d.getHours();
        setTimeHour(String(h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24));
        setTimeMin(String(d.getMinutes()).padStart(2, "0"));
        setTimeAmpm(h24 >= 12 ? "pm" : "am");
      } else {
        setTimeHour("9");
        setTimeMin("00");
        setTimeAmpm("am");
      }
      setShowEndDate(!!recurring?.endDate);
    }, 60);
    return () => clearTimeout(id);
  }, [open, deadline, recurring?.endDate]);

  function handleTitleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    onTitleChange(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${e.target.scrollHeight}px`;
  }

  function handleDateChange(newDate: string) {
    onDeadlineChange(buildDeadline(newDate, timeHour, timeMin, timeAmpm));
    if (!newDate) onRecurringChange?.(null);
  }

  function handleHourChange(h: string) {
    setTimeHour(h);
    if (datePart) onDeadlineChange(buildDeadline(datePart, h, timeMin, timeAmpm));
  }

  function handleMinChange(m: string) {
    setTimeMin(m);
    if (datePart) onDeadlineChange(buildDeadline(datePart, timeHour, m, timeAmpm));
  }

  function handleAmpmChange(a: Ampm) {
    setTimeAmpm(a);
    if (datePart) onDeadlineChange(buildDeadline(datePart, timeHour, timeMin, a));
  }

  function toggleRecurring() {
    if (recurring?.enabled) {
      onRecurringChange?.(null);
    } else {
      onRecurringChange?.({ enabled: true, frequency: "monthly", interval: 1, endDate: null });
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.45 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 z-[55] bg-black"
            onClick={onCancel}
          />

          <motion.div
            key="dialog"
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed top-[10%] left-1/2 z-[60] w-[calc(100%-2rem)] max-w-xs -translate-x-1/2 sm:top-[22%]"
            style={{ boxShadow: "5px 5px 0 var(--border)" }}
          >
            <div className="border-border bg-background flex max-h-[80vh] flex-col overflow-hidden border-2">
              <div className="bg-foreground text-background flex shrink-0 items-center justify-between px-3 py-1.5">
                <span className="font-pixel text-xs">
                  {mode === "add" ? "new item" : "edit item"}
                </span>
                <BracketButton variant="inverted" onClick={onCancel}>
                  x
                </BracketButton>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-muted-foreground font-mono text-[10px]">title</label>
                  <textarea
                    ref={textareaRef}
                    value={title}
                    onChange={handleTitleChange}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && title.trim()) {
                        e.preventDefault();
                        onConfirm();
                      }
                      if (e.key === "Escape") onCancel();
                    }}
                    placeholder={error || "what needs doing?"}
                    maxLength={500}
                    disabled={pending}
                    rows={1}
                    className={cn(
                      "border-border focus:border-foreground w-full resize-none overflow-hidden border-b bg-transparent py-1.5 text-sm outline-none disabled:opacity-50",
                      error ? "placeholder:text-destructive" : "placeholder:text-muted-foreground"
                    )}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-muted-foreground font-mono text-[10px]">when</label>
                  <DatePicker value={datePart} onChange={handleDateChange} disabled={pending} />
                  {hasDate && (
                    <TimeScrollPicker
                      hour={timeHour}
                      min={timeMin}
                      ampm={timeAmpm}
                      onHourChange={handleHourChange}
                      onMinChange={handleMinChange}
                      onAmpmChange={handleAmpmChange}
                      disabled={pending}
                    />
                  )}
                </div>

                {hasDate && onRecurringChange && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label className="text-muted-foreground font-mono text-[10px]">
                        ↺ repeats
                      </label>
                      <OptionButton
                        active={!!recurring?.enabled}
                        onClick={toggleRecurring}
                        disabled={pending}
                      >
                        {recurring?.enabled ? "on" : "off"}
                      </OptionButton>
                    </div>

                    {recurring?.enabled && (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground font-mono text-[10px]">every</span>
                          <input
                            type="number"
                            min={1}
                            value={recurring.interval}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              onRecurringChange({
                                ...recurring,
                                interval: Number.isFinite(val) && val > 0 ? val : 1,
                              });
                            }}
                            disabled={pending}
                            className="border-border w-10 border-b bg-transparent py-0.5 text-center font-mono text-xs outline-none disabled:opacity-50"
                          />
                          <div className="flex flex-wrap gap-1">
                            {RECURRING_FREQUENCIES.map((f) => (
                              <OptionButton
                                key={f.value}
                                active={recurring.frequency === f.value}
                                onClick={() =>
                                  onRecurringChange({ ...recurring, frequency: f.value })
                                }
                                disabled={pending}
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
                            <span className="text-muted-foreground font-mono text-[10px]">
                              ends
                            </span>
                            <DatePicker
                              value={recurring.endDate ?? ""}
                              onChange={(v) =>
                                onRecurringChange({ ...recurring, endDate: v || null })
                              }
                              disabled={pending}
                            />
                            <button
                              onClick={() => {
                                setShowEndDate(false);
                                onRecurringChange({ ...recurring, endDate: null });
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
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-muted-foreground font-mono text-[10px]">status</label>
                  <div className="flex flex-wrap gap-1.5">
                    {statuses.map((s) => (
                      <OptionButton
                        key={s.name}
                        active={status === s.name}
                        onClick={() => onStatusChange(s.name)}
                        disabled={pending}
                        className="flex items-center gap-1.5"
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        {s.name}
                      </OptionButton>
                    ))}
                  </div>
                  {status && !statuses.find((s) => s.name === status) && (
                    <p className="text-destructive font-mono text-[10px]">
                      &quot;{status}&quot; is not a valid status — pick one above to fix it
                    </p>
                  )}
                </div>
              </div>

              <div className="border-border flex shrink-0 items-center justify-between border-t px-3 py-2.5">
                {onDelete ? (
                  <button
                    onClick={onDelete}
                    disabled={pending}
                    className="text-foreground/60 hover:text-destructive transition-colors disabled:opacity-25"
                  >
                    <Trash2 size={12} />
                  </button>
                ) : (
                  <span />
                )}
                <BracketButton onClick={onConfirm} disabled={!title.trim() || pending}>
                  {mode === "add" ? "add" : "update"}
                </BracketButton>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

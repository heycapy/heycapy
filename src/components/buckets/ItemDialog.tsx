"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, X } from "lucide-react";
import { DatePicker } from "@/components/ui/DatePicker";
import { BracketButton } from "@/components/ui/BracketButton";
import { OptionButton } from "@/components/ui/OptionButton";
import { TimeScrollPicker, type Ampm } from "@/components/ui/TimeScrollPicker";
import { RecurringPicker } from "./RecurringPicker";
import { ItemFieldsForm } from "./ItemFieldsForm";
import type { RecurringConfig, StatusDef, FieldDef } from "@/types/rules";
import { cn } from "@/lib/utils";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useScrollToFirst } from "@/hooks/useScrollToFirst";

const LABEL = "text-muted-foreground font-mono text-[10px]";

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

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string" && !value.trim()) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

interface ItemDialogProps {
  open: boolean;
  mode: "add" | "edit";
  title: string;
  deadline: string;
  status: string;
  statuses: StatusDef[];
  fields?: FieldDef[];
  properties?: Record<string, unknown>;
  recurring?: RecurringConfig | null;
  error?: string;
  pending?: boolean;
  onTitleChange: (v: string) => void;
  onDeadlineChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onPropertiesChange?: (v: Record<string, unknown>) => void;
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
  fields,
  properties,
  recurring,
  error,
  pending,
  onTitleChange,
  onDeadlineChange,
  onStatusChange,
  onPropertiesChange,
  onRecurringChange,
  onConfirm,
  onCancel,
  onDelete,
}: ItemDialogProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const scrollToFirst = useScrollToFirst(scrollBodyRef);
  useScrollLock(open);
  const [timeHour, setTimeHour] = useState("9");
  const [timeMin, setTimeMin] = useState("00");
  const [timeAmpm, setTimeAmpm] = useState<Ampm>("am");
  const wasOpenRef = useRef(false);
  const [validationAttempted, setValidationAttempted] = useState(false);

  const hasFields = !!(fields && fields.length > 0);

  const datePart = deadline.includes("T")
    ? (() => {
        const d = new Date(deadline);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      })()
    : deadline;
  const hasDate = datePart.length > 0;

  const hasEmptyRequired = !!fields?.some(
    (f) => f.validation?.required && isEmpty(properties?.[f.key])
  );

  useEffect(() => {
    const didJustOpen = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (!didJustOpen) return;
    setValidationAttempted(false);
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
    }, 60);
    return () => clearTimeout(id);
  }, [open, deadline]);

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

  function handleConfirmClick() {
    setValidationAttempted(true);
    if (!title.trim()) {
      scrollToFirst("[data-title-section]");
      return;
    }
    if (hasEmptyRequired) {
      const firstEmpty = fields?.find(
        (f) => f.validation?.required && isEmpty(properties?.[f.key])
      );
      if (firstEmpty) scrollToFirst(`[data-field-key="${firstEmpty.key}"]`);
      return;
    }
    onConfirm();
  }

  const titleHasError = validationAttempted && !title.trim();

  const whenAndStatus = (
    <>
      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>when</label>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <DatePicker value={datePart} onChange={handleDateChange} disabled={pending} />
          </div>
          {hasDate && !pending && (
            <button
              onClick={() => handleDateChange("")}
              className="text-muted-foreground hover:text-destructive shrink-0 transition-colors"
            >
              <X size={11} />
            </button>
          )}
        </div>
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
        <RecurringPicker
          recurring={recurring}
          initialShowEndDate={!!recurring?.endDate}
          disabled={pending}
          onChange={onRecurringChange}
        />
      )}

      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>status</label>
        <div className="flex flex-wrap gap-1.5">
          {statuses.map((s) => (
            <OptionButton
              key={s.name}
              active={status === s.name}
              onClick={() => onStatusChange(s.name)}
              disabled={pending}
              className="flex items-center gap-1.5"
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
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
    </>
  );

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
            className={cn(
              "fixed top-[5%] left-1/2 z-[60] w-[calc(100%-2rem)] -translate-x-1/2",
              hasFields ? "max-w-md" : "max-w-sm"
            )}
            style={{ boxShadow: "5px 5px 0 var(--border)" }}
          >
            <div className="border-border bg-background flex max-h-[78vh] flex-col overflow-hidden border-2">
              <div className="bg-foreground text-background flex shrink-0 items-center justify-between px-3 py-1.5">
                <span className="font-pixel text-xs">
                  {mode === "add" ? "new item" : "edit item"}
                </span>
                <BracketButton variant="inverted" onClick={onCancel}>
                  x
                </BracketButton>
              </div>

              <div
                ref={scrollBodyRef}
                className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-5 py-4"
              >
                <div data-title-section className="flex flex-col gap-1.5 pb-5">
                  <label className={cn(LABEL, titleHasError && "text-destructive")}>title</label>
                  <textarea
                    ref={textareaRef}
                    value={title}
                    onChange={handleTitleChange}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && title.trim()) {
                        e.preventDefault();
                        handleConfirmClick();
                      }
                      if (e.key === "Escape") onCancel();
                    }}
                    placeholder={error || "what needs doing?"}
                    maxLength={500}
                    disabled={pending}
                    rows={1}
                    className={cn(
                      "focus:border-foreground w-full resize-none overflow-hidden border-b bg-transparent py-1.5 text-sm outline-none disabled:opacity-50",
                      error || titleHasError
                        ? "border-destructive placeholder:text-destructive"
                        : "border-border placeholder:text-muted-foreground"
                    )}
                  />
                  {titleHasError && (
                    <p className="text-destructive font-mono text-[9px]">title is required</p>
                  )}
                </div>

                {hasFields ? (
                  <div className="flex flex-col gap-5">
                    {onPropertiesChange && fields && (
                      <div className="border-border border">
                        <ItemFieldsForm
                          fields={fields}
                          values={properties ?? {}}
                          disabled={pending}
                          showErrors={validationAttempted}
                          onChange={onPropertiesChange}
                        />
                      </div>
                    )}
                    {whenAndStatus}
                  </div>
                ) : (
                  <div className="flex flex-col gap-5">{whenAndStatus}</div>
                )}
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
                <BracketButton onClick={handleConfirmClick} disabled={pending}>
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

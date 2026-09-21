"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GripVertical, Zap, Cpu } from "lucide-react";
import type { DragControls } from "framer-motion";
import { cn } from "@/lib/utils";
import type { items } from "@/lib/db/schema";
import { ITEM_STATUSES } from "./constants";

type ItemRow = typeof items.$inferSelect;

interface ItemRowProps {
  item: ItemRow;
  dragControls?: DragControls;
  isEditing?: boolean;
  onEditStart?: () => void;
  onStatusChange?: (status: string) => void;
}

const STATUS_DOT: Record<string, string> = Object.fromEntries(
  ITEM_STATUSES.map((s) => [s.value, s.color])
);

function StatusPicker({
  current,
  position,
  onSelect,
  onClose,
}: {
  current: string;
  position: { top: number; left: number };
  onSelect: (s: string) => void;
  onClose: () => void;
}) {
  return createPortal(
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div
        className="bg-background border-border fixed z-40 border-2 py-1"
        style={{
          top: position.top,
          left: position.left,
          boxShadow: "2px 2px 0 var(--border)",
        }}
      >
        {ITEM_STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => onSelect(s.value)}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-1.5 font-mono text-xs transition-colors",
              s.value === current
                ? "bg-foreground text-background"
                : "text-foreground hover:bg-muted"
            )}
          >
            <span className={cn("h-2 w-2 shrink-0 rounded-full", s.color)} />
            {s.value}
          </button>
        ))}
      </div>
    </>,
    document.body
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getRecurringFrequency(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as { enabled?: boolean; frequency?: string };
    return obj.enabled ? (obj.frequency ?? "monthly") : null;
  } catch {
    return null;
  }
}

function formatDeadline(d: Date): string {
  const date = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  if (!hasTime) return date;
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  const min = m > 0 ? `:${String(m).padStart(2, "0")}` : "";
  return `${date} ${hour}${min}${ampm}`;
}

function relativeTime(deadline: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const deadlineDay = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
  const diffDays = Math.round((deadlineDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "today";
  return `${diffDays}d`;
}

export function ItemRow({
  item,
  dragControls,
  isEditing,
  onEditStart,
  onStatusChange,
}: ItemRowProps) {
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null);
  const dotRef = useRef<HTMLButtonElement>(null);
  const rel = item.deadline ? relativeTime(item.deadline) : null;
  const isCompleted = item.status === "completed";
  const recurringFreq = getRecurringFrequency(item.recurring);
  const dotColor = STATUS_DOT[item.status] ?? "bg-muted-foreground/40";

  function openPicker() {
    if (!dotRef.current) return;
    const rect = dotRef.current.getBoundingClientRect();
    setPickerPos({ top: rect.bottom + 6, left: rect.left });
  }

  return (
    <div
      className={cn(
        "flex items-stretch gap-0 px-3",
        isEditing && "bg-muted/20",
        isCompleted && "opacity-60"
      )}
    >
      {dragControls && (
        <button
          className="text-muted-foreground/40 hover:text-muted-foreground flex shrink-0 cursor-grab touch-none items-center justify-center pr-2.5 transition-colors active:cursor-grabbing"
          onPointerDown={(e) => dragControls.start(e)}
        >
          <GripVertical size={13} />
        </button>
      )}

      <button
        ref={dotRef}
        onClick={onStatusChange ? openPicker : undefined}
        className={cn(
          "flex shrink-0 items-center justify-center pr-2.5",
          onStatusChange ? "cursor-pointer" : "cursor-default"
        )}
      >
        <span
          className={cn(
            "h-2 w-2 rounded-full transition-opacity",
            onStatusChange && "hover:opacity-60",
            dotColor
          )}
        />
      </button>

      {pickerPos && onStatusChange && (
        <StatusPicker
          current={item.status}
          position={pickerPos}
          onSelect={(s) => {
            onStatusChange(s);
            setPickerPos(null);
          }}
          onClose={() => setPickerPos(null)}
        />
      )}

      <button onClick={() => onEditStart?.()} className="min-w-0 flex-1 py-2.5 text-left">
        <span className={cn("block text-sm", isCompleted && "text-muted-foreground line-through")}>
          {item.title}
        </span>
        {item.deadline && (
          <span
            className={cn(
              "mt-0.5 block font-mono text-[10px]",
              rel === "overdue"
                ? "text-destructive"
                : rel === "today"
                  ? "text-primary"
                  : "text-muted-foreground/60"
            )}
          >
            {recurringFreq && <span className="mr-1">↺ {recurringFreq} ·</span>}
            {recurringFreq ? "next " : ""}
            {formatDeadline(item.deadline)}
            {rel === "overdue" || rel === "today" ? ` · ${rel}` : ""}
          </span>
        )}
      </button>

      <div className="flex shrink-0 items-center gap-1.5 pl-2">
        {item.source !== "manual" && (
          <span className="text-muted-foreground/40">
            {item.source === "ai" ? <Zap size={10} /> : <Cpu size={10} />}
          </span>
        )}
        {rel && rel !== "overdue" && rel !== "today" && (
          <span className="text-muted-foreground/50 font-mono text-[10px]">{rel}</span>
        )}
      </div>
    </div>
  );
}

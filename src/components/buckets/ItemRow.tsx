"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GripVertical } from "lucide-react";
import type { DragControls } from "framer-motion";
import { cn } from "@/lib/utils";
import type { items } from "@/lib/db/schema";
import type { StatusDef, FieldDef } from "@/types/rules";

type ItemRow = typeof items.$inferSelect;

interface ItemRowProps {
  item: ItemRow;
  statuses: StatusDef[];
  fields?: FieldDef[];
  dragControls?: DragControls;
  isEditing?: boolean;
  onEditStart?: () => void;
  onStatusChange?: (status: string) => void;
}

function StatusPicker({
  current,
  statuses,
  position,
  onSelect,
  onClose,
}: {
  current: string;
  statuses: StatusDef[];
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
        {statuses.map((s) => (
          <button
            key={s.name}
            onClick={() => onSelect(s.name)}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-1.5 font-mono text-xs transition-colors",
              s.name === current
                ? "bg-foreground text-background"
                : "text-foreground hover:bg-muted"
            )}
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            {s.name}
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
  if (diffDays === 0) return deadline < now ? "overdue" : "today";
  return `${diffDays}d`;
}

function getShowInRowBadges(
  fields: FieldDef[],
  propertiesRaw: string | null
): { label: string; value: string }[] {
  if (!propertiesRaw) return [];
  let props: Record<string, unknown>;
  try {
    props = JSON.parse(propertiesRaw) as Record<string, unknown>;
  } catch {
    return [];
  }
  return fields
    .filter((f) => f.showInRow)
    .flatMap((f) => {
      const v = props[f.key];
      if (v === undefined || v === null || v === "") return [];
      let display: string;
      if (f.type === "boolean") {
        display = v ? "yes" : "no";
      } else if (f.type === "currency") {
        display = `${f.currency ?? ""}${typeof v === "number" ? v.toFixed(2) : String(v)}`;
      } else if (Array.isArray(v)) {
        display = v.join(", ");
      } else {
        display = String(v);
      }
      return [{ label: f.label, value: display }];
    });
}

export function ItemRow({
  item,
  statuses,
  fields,
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
  const dotColor = statuses.find((s) => s.name === item.status)?.color ?? "var(--muted-foreground)";
  const badges = fields ? getShowInRowBadges(fields, item.properties) : [];

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
            onStatusChange && "hover:opacity-60"
          )}
          style={{ backgroundColor: dotColor }}
        />
      </button>

      {pickerPos && onStatusChange && (
        <StatusPicker
          current={item.status}
          statuses={statuses}
          position={pickerPos}
          onSelect={(s) => {
            onStatusChange(s);
            setPickerPos(null);
          }}
          onClose={() => setPickerPos(null)}
        />
      )}

      <button
        onClick={() => onEditStart?.()}
        className="min-w-0 flex-1 overflow-hidden py-2.5 text-left"
      >
        <span
          className={cn(
            "block truncate text-sm",
            isCompleted && "text-muted-foreground line-through"
          )}
        >
          {item.title}
        </span>
        {badges.length > 0 && (
          <span className="mt-0.5 flex flex-wrap gap-1">
            {badges.map((b) => (
              <span
                key={b.label}
                className="border-border text-muted-foreground border px-1 font-mono text-[9px]"
              >
                {b.label}: {b.value}
              </span>
            ))}
          </span>
        )}
        <span className="mt-0.5 flex items-center gap-1 font-mono text-[10px]">
          <span className="text-muted-foreground/30">#{item.id}</span>
          {(item.deadline ?? item.notifiedAt) && (
            <>
              {recurringFreq && <span className="text-muted-foreground">· ↺ {recurringFreq}</span>}
              {item.deadline && (
                <span
                  className={cn(
                    rel === "overdue"
                      ? "bg-destructive/15 text-destructive px-1"
                      : rel === "today"
                        ? "font-medium text-(--status-snoozed)"
                        : "text-muted-foreground"
                  )}
                >
                  {recurringFreq ? "next " : ""}
                  {formatDeadline(item.deadline)}
                  {rel === "today" ? " · today" : rel === "overdue" ? " · overdue" : ""}
                </span>
              )}
              {item.notifiedAt && <span className="text-muted-foreground">· notified</span>}
            </>
          )}
        </span>
      </button>

      {rel && rel !== "overdue" && rel !== "today" && (
        <span className="text-muted-foreground/50 shrink-0 pl-2 font-mono text-[10px]">{rel}</span>
      )}
    </div>
  );
}

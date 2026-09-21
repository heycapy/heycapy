"use client";

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
}

const STATUS_DOT: Record<string, string> = Object.fromEntries(
  ITEM_STATUSES.map((s) => [s.value, s.color])
);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDeadline(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function relativeTime(deadline: Date): string {
  const days = Math.floor((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  return `${days}d`;
}

export function ItemRow({ item, dragControls, isEditing, onEditStart }: ItemRowProps) {
  const rel = item.deadline ? relativeTime(item.deadline) : null;
  const isCompleted = item.status === "completed";
  const dotColor = STATUS_DOT[item.status] ?? "bg-muted-foreground/40";

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 px-3 py-2.5",
        isEditing && "bg-muted/20",
        isCompleted && "opacity-60"
      )}
    >
      {dragControls && (
        <button
          className="text-muted-foreground/40 hover:text-muted-foreground mt-0.5 shrink-0 cursor-grab touch-none transition-colors active:cursor-grabbing"
          onPointerDown={(e) => dragControls.start(e)}
        >
          <GripVertical size={13} />
        </button>
      )}

      <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", dotColor)} />

      <button onClick={() => onEditStart?.()} className="min-w-0 flex-1 text-left">
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
            {formatDeadline(item.deadline)}
            {rel === "overdue" || rel === "today" ? ` · ${rel}` : ""}
          </span>
        )}
      </button>

      <div className="mt-0.5 flex shrink-0 items-center gap-1.5">
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

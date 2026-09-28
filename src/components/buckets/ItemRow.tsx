import { formatShort, formatShortTime } from "@/lib/format-date";
import { ITEM_STATUS, isClosedStatus } from "@/constants";
import { ITEM_HIGHLIGHT_MS } from "./constants";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, BellOff, GripVertical, TriangleAlert } from "lucide-react";
import type { DragControls } from "framer-motion";
import { cn } from "@/lib/utils";
import type { items } from "@/lib/db/schema";
import type { StatusDef, FieldDef } from "@/types/rules";
import type { ReminderBadge } from "@/lib/reminders/status";
import { ReminderInfoDialog } from "./ReminderInfoDialog";
import { pendingRemindAgainAt } from "@/lib/reminders/remind-again";
import { parseRecurring } from "@/lib/items/occurrence";
import { repeatLabel } from "@/lib/items/repeat-label";

type ItemRow = typeof items.$inferSelect;

type ItemRowProps = {
  item: ItemRow;
  statuses: StatusDef[];
  fields?: FieldDef[];
  dragControls?: DragControls;
  isEditing?: boolean;
  onEditStart?: () => void;
  onStatusChange?: (status: string) => void;
  reminderBadge?: ReminderBadge;
};

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

function getRecurringFrequency(raw: string | null): string | null {
  const config = parseRecurring(raw);
  return config?.enabled ? repeatLabel(config) : null;
}

function relativeTime(deadline: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const deadlineDay = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
  const diffDays = Math.round((deadlineDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "overdue";
  const allDay = deadline.getHours() === 0 && deadline.getMinutes() === 0;
  if (diffDays === 0) return !allDay && deadline < now ? "overdue" : "today";
  return `${diffDays}d`;
}

function daysLeftColor(rel: string): string {
  const d = parseInt(rel);
  if (d <= 2) return "text-orange-500";
  if (d <= 5) return "text-yellow-500";
  return "text-muted-foreground/50";
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
      const label = f.label.length > 15 ? f.label.slice(0, 15) + "…" : f.label;
      const value = display.length > 20 ? display.slice(0, 20) + "…" : display;
      return [{ label, value }];
    });
}

const REMINDER_ICON: Record<ReminderBadge, { Icon: typeof Bell; className: string }> = {
  upcoming: { Icon: Bell, className: "text-muted-foreground" },
  noChannel: { Icon: BellOff, className: "text-muted-foreground/60" },
  failed: { Icon: TriangleAlert, className: "text-warning" },
  history: { Icon: Bell, className: "text-muted-foreground/30" },
};

function remindAgainLabel(item: ItemRow): string | null {
  const now = new Date();
  const at = pendingRemindAgainAt(item, now);
  return at ? `⏰ again ${formatShortTime(at, now)}` : null;
}

function reminderLabel(badge: ReminderBadge, next: Date | null): string {
  if (badge === "failed") return "reminder failed";
  if (badge === "noChannel") return "no reminder";
  if (badge === "history") return "reminder history";
  return next ? `reminder ${formatShort(next)}` : "reminder";
}

export function ItemRow({
  item,
  statuses,
  fields,
  dragControls,
  isEditing,
  onEditStart,
  onStatusChange,
  reminderBadge,
}: ItemRowProps) {
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const ReminderIcon = reminderBadge ? REMINDER_ICON[reminderBadge].Icon : null;
  const dotRef = useRef<HTMLButtonElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const anchor = `item-${item.id}`;
  const [highlighted, setHighlighted] = useState(() => window.location.hash === `#${anchor}`);

  useEffect(() => {
    if (!highlighted) return;
    rowRef.current?.scrollIntoView({ block: "center" });
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    const fade = setTimeout(() => setHighlighted(false), ITEM_HIGHLIGHT_MS);
    return () => clearTimeout(fade);
  }, [highlighted]);
  const rel = item.deadline && !isClosedStatus(item.status) ? relativeTime(item.deadline) : null;
  const isCompleted = item.status === ITEM_STATUS.completed;
  const isMissed = item.status === ITEM_STATUS.missed;
  const remindAgain = remindAgainLabel(item);
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
      ref={rowRef}
      id={anchor}
      className={cn(
        "flex items-stretch gap-0 px-3 transition-colors duration-1000",
        highlighted && "bg-primary/15",
        isEditing && "bg-muted/20",
        (isCompleted || isMissed) && "opacity-60"
      )}
    >
      {dragControls && (
        <button
          className="text-muted-foreground/40 hover:text-muted-foreground flex shrink-0 cursor-grab touch-none items-center justify-center pr-2.5 transition-colors active:cursor-grabbing"
          onPointerDown={(e) => dragControls.start(e)}
          aria-label="drag to reorder"
        >
          <GripVertical size={13} />
        </button>
      )}

      <button
        ref={dotRef}
        onClick={onStatusChange ? openPicker : undefined}
        aria-label={`status: ${item.status}`}
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
        <span className="mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-0.5 font-mono text-[10px] *:whitespace-nowrap">
          <span className="text-muted-foreground/30">#{item.id}</span>
          {isMissed && <span className="text-warning">· ⏭ missed</span>}
          {(item.deadline ?? item.notifiedAt) && (
            <>
              {recurringFreq && <span className="text-muted-foreground">· ↺ {recurringFreq}</span>}
              {item.deadline && (
                <span
                  className={cn(
                    rel === "overdue"
                      ? "bg-destructive/15 text-destructive px-1"
                      : rel === "today"
                        ? "font-medium text-(--status-on-hold)"
                        : "text-muted-foreground"
                  )}
                >
                  {recurringFreq ? "next " : ""}
                  {formatShort(item.deadline)}
                  {rel === "today" ? " · today" : rel === "overdue" ? " · overdue" : ""}
                </span>
              )}
              {item.notifiedAt && <span className="text-muted-foreground">· notified</span>}
            </>
          )}
        </span>
        {remindAgain && (
          <span className="text-foreground/80 mt-0.5 block font-mono text-[10px]">
            {remindAgain}
          </span>
        )}
      </button>

      {rel && rel !== "overdue" && rel !== "today" && (
        <span
          className={cn(
            "flex shrink-0 items-center pl-2 font-mono text-[10px]",
            daysLeftColor(rel)
          )}
        >
          {rel}
        </span>
      )}

      {reminderBadge && ReminderIcon && (
        <button
          type="button"
          onClick={() => setReminderOpen(true)}
          aria-label={reminderLabel(reminderBadge, item.nextReminderAt)}
          title={reminderLabel(reminderBadge, item.nextReminderAt)}
          className={cn(
            "flex shrink-0 items-center pl-2 transition-opacity hover:opacity-70",
            REMINDER_ICON[reminderBadge].className
          )}
        >
          <ReminderIcon size={11} aria-hidden />
        </button>
      )}
      {reminderOpen && (
        <ReminderInfoDialog
          itemId={item.id}
          title={item.title}
          onClose={() => setReminderOpen(false)}
        />
      )}
    </div>
  );
}

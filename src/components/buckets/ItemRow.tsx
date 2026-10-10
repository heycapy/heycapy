import { formatShort, formatShortTime } from "@/lib/format-date";
import { ITEM_STATUS, isClosedStatus } from "@/constants";
import { ITEM_HIGHLIGHT_MS } from "./constants";
import { StatusPicker, type StatusAnchor } from "./StatusPicker";
import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, Ellipsis, GripVertical, TriangleAlert } from "lucide-react";
import type { DragControls } from "framer-motion";
import { cn } from "@/lib/utils";
import type { items } from "@/lib/db/schema";
import type { StatusDef, FieldDef } from "@/types/rules";
import type { ReminderBadge } from "@/lib/reminders/status";
import { ReminderInfoDialog } from "./ReminderInfoDialog";
import type { MenuAt } from "./ItemMenu";
import { pendingRemindAgainAt } from "@/lib/reminders/remind-again";
import { relativeTime } from "@/lib/items/relative-day";
import { itemDeadline } from "@/lib/time";
import { parseRecurring } from "@/lib/items/occurrence";
import { repeatLabel } from "@/lib/items/repeat-label";

type ItemRow = typeof items.$inferSelect;

type ItemRowProps = {
  item: ItemRow;
  statuses: StatusDef[];
  fields?: FieldDef[];
  dragControls?: DragControls;
  isEditing?: boolean;
  menuOpen?: boolean;
  onEditStart?: () => void;
  onStatusChange?: (status: string) => void;
  reminderBadge?: ReminderBadge;
  assignee?: string;
  bucket?: { name: string; color: string };
  onMenu?: (at: MenuAt) => void;
};

function getRecurringFrequency(raw: string | null): string | null {
  const config = parseRecurring(raw);
  return config?.enabled ? repeatLabel(config) : null;
}

function daysLeftColor(rel: string): string {
  const d = parseInt(rel);
  if (d <= 2) return "text-orange-500";
  if (d <= 5) return "text-yellow-500";
  return "text-muted-foreground";
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
  noChannel: { Icon: BellOff, className: "text-muted-foreground" },
  failed: { Icon: TriangleAlert, className: "text-warning" },
  history: { Icon: Bell, className: "text-muted-foreground/50" },
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
  menuOpen,
  onEditStart,
  onStatusChange,
  reminderBadge,
  assignee,
  bucket,
  onMenu,
}: ItemRowProps) {
  const [pickerAnchor, setPickerAnchor] = useState<StatusAnchor | null>(null);
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
  const due = item.deadline ? itemDeadline(item.deadline, item.deadlineTimezone) : null;
  const rel =
    due && !isClosedStatus(item.status) ? relativeTime(due.at, undefined, due.allDay) : null;
  const isCompleted = item.status === ITEM_STATUS.completed;
  const isMissed = item.status === ITEM_STATUS.missed;
  const remindAgain = remindAgainLabel(item);
  const recurringFreq = getRecurringFrequency(item.recurring);
  const dotColor = statuses.find((s) => s.name === item.status)?.color ?? "var(--muted-foreground)";
  const badges = fields ? getShowInRowBadges(fields, item.properties) : [];

  function openPicker() {
    if (!dotRef.current) return;
    const rect = dotRef.current.getBoundingClientRect();
    setPickerAnchor({ top: rect.top, bottom: rect.bottom, left: rect.left });
  }

  return (
    <div
      ref={rowRef}
      id={anchor}
      className={cn(
        "flex items-stretch gap-0 px-3 transition-colors duration-1000",
        highlighted && "bg-primary/15",
        isEditing && "bg-muted/20",
        menuOpen && "bg-card duration-0",
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
          "-ml-1.5 flex shrink-0 items-center justify-center pr-3 pl-1.5",
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

      {pickerAnchor && onStatusChange && (
        <StatusPicker
          current={item.status}
          statuses={statuses}
          anchor={pickerAnchor}
          onSelect={(s) => {
            onStatusChange(s);
            setPickerAnchor(null);
          }}
          onClose={() => setPickerAnchor(null)}
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
                className="border-border text-muted-foreground border px-1 font-mono text-[11px]"
              >
                {b.label}: {b.value}
              </span>
            ))}
          </span>
        )}
        <span className="mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-0.5 font-mono text-xs *:whitespace-nowrap">
          <span className="text-muted-foreground/60">#{item.id}</span>
          {assignee && <span className="text-muted-foreground">→ {assignee}</span>}
          {bucket && (
            <span className="text-muted-foreground flex items-center gap-1">
              ·
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: bucket.color }}
              />
              {bucket.name}
            </span>
          )}
          {bucket && !item.deadline && <span className="text-muted-foreground">· no date</span>}
          {isMissed && <span className="text-warning">· ⏭ missed</span>}
          {(item.deadline ?? item.notifiedAt) && (
            <>
              {due && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span
                    className={cn(
                      rel === "overdue"
                        ? "bg-destructive/15 text-destructive px-1"
                        : rel === "today"
                          ? "font-medium text-(--status-on-hold)"
                          : "text-muted-foreground"
                    )}
                  >
                    {formatShort(due.at, due.allDay)}
                    {rel === "today" ? " · today" : rel === "overdue" ? " · overdue" : ""}
                  </span>
                </>
              )}
              {recurringFreq && <span className="text-muted-foreground">· ↺ {recurringFreq}</span>}
              {item.notifiedAt && <span className="text-muted-foreground">· notified</span>}
            </>
          )}
        </span>
        {remindAgain && (
          <span className="text-foreground/80 mt-0.5 block font-mono text-xs">{remindAgain}</span>
        )}
      </button>

      {rel && rel !== "overdue" && rel !== "today" && (
        <span
          className={cn("flex shrink-0 items-center pl-2 font-mono text-xs", daysLeftColor(rel))}
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
      {onMenu && (
        <button
          type="button"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            onMenu({ x: rect.left, top: rect.top, bottom: rect.bottom });
          }}
          aria-label="item menu"
          className="text-muted-foreground hover:text-foreground -mr-3 flex shrink-0 items-center px-3 transition-colors"
        >
          <Ellipsis size={14} aria-hidden />
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

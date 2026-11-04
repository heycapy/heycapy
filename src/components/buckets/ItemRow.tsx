import { MoreHorizontal } from "pixelarticons/react/MoreHorizontal.js";
import { MoreVertical } from "pixelarticons/react/MoreVertical.js";
import { WarningDiamond } from "pixelarticons/react/WarningDiamond.js";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { formatShortTime } from "@/lib/format-date";
import { ITEM_STATUS } from "@/constants";
import { ITEM_HIGHLIGHT_MS } from "./constants";
import { StatusPicker, type StatusAnchor } from "./StatusPicker";
import { useEffect, useRef, useState } from "react";
import type { DragControls } from "framer-motion";
import { cn } from "@/lib/utils";
import type { StatusDef, FieldDef } from "@/types/rules";
import type { ListItem, ReminderBadge } from "@/lib/reminders/status";
import { ReminderInfoDialog } from "./ReminderInfoDialog";
import type { MenuAt } from "./ItemMenu";
import { pendingRemindAgainAt } from "@/lib/reminders/remind-again";
import { itemDeadline } from "@/lib/time";
import { parseRecurring } from "@/lib/items/occurrence";
import { repeatLabel } from "@/lib/items/repeat-label";
import { PersonAvatar } from "@/components/avatar/PersonAvatar";
import { ItemDue } from "./ItemDue";

export type ItemAssignee = { userId: number; name: string; avatar: string | null; isYou: boolean };

type ItemRow = ListItem;

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
  assignee?: ItemAssignee;
  // The time on another clock that matters for this item, e.g. "9am for Sam"
  otherClock?: string;
  bucket?: { name: string; color: string };
  // Off when no item in the list has a date, so a list of notes has no empty column
  showDue?: boolean;
  // A bucket with more than one member says "anyone" on items nobody is assigned to
  shared?: boolean;
  // Who completed it, named in shared buckets
  tickedBy?: string;
  onMenu?: (at: MenuAt) => void;
};

function getRecurringFrequency(raw: string | null): string | null {
  const config = parseRecurring(raw);
  return config?.enabled ? repeatLabel(config) : null;
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

function remindAgainLabel(item: ItemRow): string | null {
  const now = new Date();
  const at = pendingRemindAgainAt(item, now);
  return at ? `⏰ again ${formatShortTime(at, now)}` : null;
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
  otherClock,
  bucket,
  showDue = true,
  shared = false,
  tickedBy,
  onMenu,
}: ItemRowProps) {
  const [pickerAnchor, setPickerAnchor] = useState<StatusAnchor | null>(null);
  const [reminderOpen, setReminderOpen] = useState(false);
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
  const isCompleted = item.status === ITEM_STATUS.completed;
  const isMissed = item.status === ITEM_STATUS.missed;
  const remindAgain = remindAgainLabel(item);
  const recurringFreq = getRecurringFrequency(item.recurring);
  const dotColor = statuses.find((s) => s.name === item.status)?.color ?? "var(--muted-foreground)";
  const badges = fields ? getShowInRowBadges(fields, item.properties) : [];
  const meta = [
    otherClock && <span key="clock">({otherClock})</span>,
    assignee && (
      <span key="assignee" className={cn(assignee.isYou && "text-foreground")}>
        →{" "}
        <PersonAvatar
          userId={assignee.userId}
          avatar={assignee.avatar}
          className={cn("mr-1 inline-block align-text-bottom", !assignee.isYou && "@max-lg:mr-0")}
        />
        {/* Narrow lists show other people by their face only; "you" keeps its word */}
        <span className={cn(!assignee.isYou && "@max-lg:sr-only")}>{assignee.name}</span>
      </span>
    ),
    tickedBy && <span key="ticked">ticked by {tickedBy}</span>,
    shared && !assignee && !tickedBy && (
      <span key="anyone" className="text-muted-foreground/60">
        anyone
      </span>
    ),
    bucket && (
      <span key="bucket" className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: bucket.color }} />
        {bucket.name}
      </span>
    ),
    recurringFreq && <span key="repeat">↺ {recurringFreq}</span>,
    item.notifiedAt && <span key="notified">notified</span>,
  ].filter((part) => !!part);

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
        "group/row flex items-stretch gap-0 px-3 transition-colors duration-1000",
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
          <PixelIcon icon={MoreVertical} />
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
        className="flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left"
      >
        <span className="min-w-0 flex-1">
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
                  className="border-border text-muted-foreground border px-1 py-1 font-mono text-[11px] [text-box:trim-both_cap_alphabetic]"
                >
                  {b.label}: {b.value}
                </span>
              ))}
            </span>
          )}
          {meta.length > 0 && (
            <span className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-0.5 font-mono text-xs *:whitespace-nowrap">
              {meta.map((part, i) => (
                <span key={part.key} className="flex items-center gap-1">
                  {i > 0 && <span aria-hidden>·</span>}
                  {part}
                </span>
              ))}
            </span>
          )}
          {remindAgain && (
            <span className="text-foreground/80 mt-0.5 block font-mono text-xs">{remindAgain}</span>
          )}
        </span>
        {showDue && <ItemDue due={due} status={item.status} />}
      </button>

      {/* Only a failed send shows in the row; everything else about reminders is in the menu */}
      {reminderBadge === "failed" && (
        <button
          type="button"
          onClick={() => setReminderOpen(true)}
          aria-label="reminder failed"
          title="reminder failed"
          className="text-destructive flex shrink-0 items-center pl-2 transition-opacity hover:opacity-70"
        >
          <PixelIcon icon={WarningDiamond} />
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
          className={cn(
            "text-muted-foreground hover:text-foreground -mr-3 flex shrink-0 items-center px-3 transition-[color,opacity]",
            // Mouse users see it on hover, touch screens always; right-click and long-press open it too
            !menuOpen &&
              "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/row:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
          )}
        >
          <PixelIcon icon={MoreHorizontal} />
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

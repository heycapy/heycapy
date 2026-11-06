import { MoreHorizontal } from "pixelarticons/react/MoreHorizontal.js";
import { WarningDiamond } from "pixelarticons/react/WarningDiamond.js";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { GripIcon } from "@/components/ui/GripIcon";
import { formatShortTime } from "@/lib/format-date";
import { ITEM_STATUS, TITLE_LINES_SHOWN } from "@/constants";
import { ITEM_HIGHLIGHT_MS, JUST_ADDED_MS } from "./constants";
import { useUIStore } from "@/store/ui";
import { TickBox } from "./TickBox";
import { completionToggle } from "./completion";
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
import { MODAL_PANEL_SELECTOR } from "@/components/ui/constants";

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
  color?: string;
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
  color = "var(--muted-foreground)",
  showDue = true,
  shared = false,
  tickedBy,
  onMenu,
}: ItemRowProps) {
  const [reminderOpen, setReminderOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const anchor = `item-${item.id}`;
  const highlighted = useUIStore((s) => s.highlightedItemId === item.id);
  const clearHighlight = useUIStore((s) => s.clearHighlight);
  const justAdded = useUIStore((s) => s.lastAddedItemId === item.id);
  const clearAdded = useUIStore((s) => s.clearAdded);

  useEffect(() => {
    if (!justAdded) return;
    rowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const fade = setTimeout(() => clearAdded(item.id), JUST_ADDED_MS);
    return () => clearTimeout(fade);
  }, [justAdded, clearAdded, item.id]);

  useEffect(() => {
    if (!highlighted) return;
    rowRef.current?.scrollIntoView({ block: "center" });
    const fade = setTimeout(() => clearHighlight(item.id), ITEM_HIGHLIGHT_MS);
    return () => clearTimeout(fade);
  }, [highlighted, clearHighlight, item.id]);
  const due = item.deadline ? itemDeadline(item.deadline, item.deadlineTimezone) : null;
  const isCompleted = item.status === ITEM_STATUS.completed;
  const isMissed = item.status === ITEM_STATUS.missed;
  const remindAgain = remindAgainLabel(item);
  const recurringFreq = getRecurringFrequency(item.recurring);
  const allLines = item.title.split("\n").filter((line) => line.trim());
  const titleLines = allLines.slice(0, TITLE_LINES_SHOWN);
  const moreLines = allLines.length > TITLE_LINES_SHOWN;
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

  return (
    <div
      ref={rowRef}
      id={anchor}
      data-just-added={justAdded || undefined}
      className={cn(
        "group/row flex items-stretch gap-0 px-3 transition-colors duration-1000",
        justAdded && "bg-primary/8",
        highlighted && "bg-primary/15",
        isEditing && "bg-muted/20",
        menuOpen && "bg-card duration-0",
        (isCompleted || isMissed) && "opacity-45"
      )}
    >
      {dragControls && (
        <button
          className="text-muted-foreground/60 hover:text-foreground flex shrink-0 cursor-grab touch-none items-center justify-center pr-2.5 transition-colors active:cursor-grabbing"
          onPointerDown={(e) => dragControls.start(e)}
          aria-label="drag to reorder"
        >
          <PixelIcon icon={GripIcon} />
        </button>
      )}

      <TickBox
        title={item.title}
        checked={isCompleted}
        color={color}
        onToggle={
          onStatusChange && (() => onStatusChange(completionToggle(item.status, statuses).next))
        }
      />

      <button
        onClick={() => onEditStart?.()}
        className="flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left"
      >
        <span className="min-w-0 flex-1">
          <span
            className={cn("block text-sm", isCompleted && "text-muted-foreground line-through")}
          >
            {titleLines.map((line, i) => (
              <span key={i} className="block truncate">
                {line}
                {i === titleLines.length - 1 && moreLines && " …"}
              </span>
            ))}
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
            onMenu({
              x: rect.left,
              top: rect.top,
              bottom: rect.bottom,
              within: e.currentTarget.closest<HTMLElement>(MODAL_PANEL_SELECTOR),
            });
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

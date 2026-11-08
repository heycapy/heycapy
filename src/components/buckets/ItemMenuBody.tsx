import { useState, type ComponentProps, type ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/Calendar";
import { TextButton } from "@/components/ui/TextButton";
import { CloseButton } from "@/components/ui/CloseButton";
import { Icon } from "@/components/ui/Icon";
import { clockTime, formatShort, formatWeekdayDate } from "@/lib/format-date";
import { deadlineDate, itemDeadline } from "@/lib/time";
import { deadlineOn, quickDates } from "@/lib/items/quick-dates";
import { parseRecurring } from "@/lib/items/occurrence";
import { repeatLabel } from "@/lib/items/repeat-label";
import type { ReminderBadge } from "@/lib/reminders/status";
import { ItemReminderInfo } from "./ItemReminderInfo";
import { AssignChips, AssignList } from "./ItemMenuAssign";
import type { ItemMenuProps } from "./ItemMenu";
import { MenuItem, MenuSection } from "@/components/ui/MenuItem";

type View = "main" | "date" | "people" | "reminders";

const VIEW_LABEL: Record<Exclude<View, "main">, string> = {
  date: "pick a date",
  people: "assign to",
  reminders: "reminders",
};

function MenuButton({
  label,
  className,
  ...props
}: ComponentProps<typeof MenuItem> & { label?: string }) {
  return <MenuItem aria-label={label} className={cn("gap-4", className)} {...props} />;
}

// Swiping is touch only, so only touch screens are told about it
function SwipeHint({ children }: { children: ReactNode }) {
  return (
    <span className="text-muted-foreground/60 ml-auto [@media(hover:hover)]:hidden">
      {children}
    </span>
  );
}

function reminderState(badge: ReminderBadge | undefined, next: Date | null | undefined) {
  if (badge === "failed") return <span className="text-destructive">failed</span>;
  if (badge === "noChannel") return "no working channel";
  if (badge === "upcoming") return next ? `next ${formatShort(next)}` : "on";
  if (badge === "history") return "none upcoming";
  return "none";
}

export function MenuBody({
  item,
  readonly,
  completeLabel,
  reminderBadge,
  nextReminderAt,
  assign,
  onComplete,
  onMove,
  onDelete,
  onClose,
}: Omit<ItemMenuProps, "at">) {
  const [view, setView] = useState<View>("main");
  const [moving, setMoving] = useState(false);
  const [assigneeId, setAssigneeId] = useState(item.assigneeId);
  const [assigning, setAssigning] = useState(false);
  const recurring = parseRecurring(item.recurring);
  const repeat = recurring?.enabled && item.deadline ? repeatLabel(recurring) : null;
  const current = item.deadline ? itemDeadline(item.deadline, item.deadlineTimezone).at : null;

  function run(action: () => void) {
    onClose();
    action();
  }

  // Open until the list has the new date, so the row can't be opened with the old one underneath
  async function move(deadline: string) {
    if (moving) return;
    setMoving(true);
    try {
      await onMove(deadline);
    } finally {
      onClose();
    }
  }

  // The menu stays open so the change shows, and a wrong tap is one more tap to undo
  async function assignTo(userId: number | null) {
    if (!assign || assigning) return;
    setAssigning(true);
    try {
      if (await assign.onAssign(userId)) {
        setAssigneeId(userId);
        setView("main");
      }
    } finally {
      setAssigning(false);
    }
  }

  async function copyTitle() {
    onClose();
    try {
      await navigator.clipboard.writeText(item.title);
      toast("copied");
    } catch {
      toast.error("couldn't copy");
    }
  }

  return (
    <>
      <div className="flex items-start gap-3 py-2 pl-3">
        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate text-sm">{item.title}</p>
          {repeat && (
            <p className="text-muted-foreground font-ui text-2xs mt-0.5">
              ↺ {repeat} · moves only this time
            </p>
          )}
        </div>
        <CloseButton onClick={onClose} aria-label="close menu" className="-my-1 px-3 py-1.5" />
      </div>

      {view !== "main" && (
        <MenuSection className="flex items-center gap-2 px-3">
          <TextButton icon="arrow-left" onClick={() => setView("main")} className="py-1.5">
            back
          </TextButton>
          <span className="text-muted-foreground font-ui text-xs">{VIEW_LABEL[view]}</span>
        </MenuSection>
      )}

      {view === "date" && (
        <MenuSection className="px-3 pt-1 pb-3">
          <Calendar
            value={current ? deadlineDate(current.toISOString()) : ""}
            onSelect={(date) => void move(deadlineOn(date, current))}
          />
        </MenuSection>
      )}

      {view === "people" && assign && (
        <MenuSection>
          <AssignList
            members={assign.members}
            assigneeId={assigneeId}
            busy={assigning}
            onAssign={(userId) => void assignTo(userId)}
          />
        </MenuSection>
      )}

      {view === "reminders" && (
        <MenuSection className="max-h-[50dvh] overflow-y-auto overscroll-contain px-3 py-2">
          <ItemReminderInfo itemId={item.id} />
        </MenuSection>
      )}

      {view === "main" && (
        <>
          {!readonly && (
            <MenuSection>
              <MenuButton onClick={() => run(onComplete)}>
                <span className="text-foreground">{completeLabel}</span>
                <SwipeHint>swipe →</SwipeHint>
              </MenuButton>
            </MenuSection>
          )}

          {!readonly && (
            <MenuSection>
              {quickDates(current).map((option) => {
                const day = formatWeekdayDate(option.at);
                const time = option.allDay ? "all day" : clockTime(option.at);
                return (
                  <MenuButton
                    key={option.label}
                    label={`${option.label} ${day} ${time}`}
                    onClick={() => void move(option.value)}
                    disabled={moving}
                  >
                    <span className="text-foreground flex-1">{option.label}</span>
                    <span className="text-muted-foreground w-20">{day}</span>
                    <span className="text-muted-foreground w-14">{time}</span>
                  </MenuButton>
                );
              })}
              <MenuButton onClick={() => setView("date")}>
                <span className="text-foreground flex-1">pick a date…</span>
                <Icon name="chevron-right" className="text-muted-foreground" />
              </MenuButton>
            </MenuSection>
          )}

          {!readonly && assign && (
            <MenuSection>
              <AssignChips
                members={assign.members}
                assigneeId={assigneeId}
                busy={assigning}
                onAssign={(userId) => void assignTo(userId)}
                onMore={() => setView("people")}
              />
            </MenuSection>
          )}

          {!readonly && (
            <MenuSection>
              <MenuButton onClick={() => setView("reminders")}>
                <span className="text-foreground flex-1">reminders</span>
                <span className="text-muted-foreground">
                  {reminderState(reminderBadge, nextReminderAt)}
                </span>
                <Icon name="chevron-right" className="text-muted-foreground" />
              </MenuButton>
            </MenuSection>
          )}

          <MenuSection>
            <MenuButton onClick={() => void copyTitle()}>
              <span className="text-foreground">copy title</span>
            </MenuButton>
          </MenuSection>

          {!readonly && (
            <MenuSection>
              <MenuButton onClick={() => run(onDelete)} tone="destructive">
                delete
                <SwipeHint>← swipe</SwipeHint>
              </MenuButton>
            </MenuSection>
          )}
        </>
      )}
    </>
  );
}

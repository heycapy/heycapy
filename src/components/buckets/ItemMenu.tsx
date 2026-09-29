import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/Calendar";
import { BracketButton } from "@/components/ui/BracketButton";
import { clockTime, formatWeekdayDate } from "@/lib/format-date";
import { deadlineDate } from "@/lib/time";
import { deadlineOn, quickDates } from "@/lib/items/quick-dates";
import { parseRecurring } from "@/lib/items/occurrence";
import { repeatLabel } from "@/lib/items/repeat-label";
import type { items } from "@/lib/db/schema";
import { MENU_GAP, SCREEN_MARGIN } from "./constants";

type Item = typeof items.$inferSelect;

export type MenuAt = { x: number; top: number; bottom: number };

type ItemMenuProps = {
  item: Item;
  at: MenuAt;
  readonly: boolean;
  onMove: (deadline: string) => void;
  onDelete: () => void;
  onClose: () => void;
};

function MenuButton({
  label,
  className,
  onClick,
  children,
}: {
  label?: string;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "hover:bg-muted flex w-full items-center gap-4 px-3 py-2.5 text-left font-mono text-xs transition-colors sm:py-2",
        className
      )}
    >
      {children}
    </button>
  );
}

function MenuBody({ item, readonly, onMove, onDelete, onClose }: Omit<ItemMenuProps, "at">) {
  const [picking, setPicking] = useState(false);
  const recurring = parseRecurring(item.recurring);
  const repeat = recurring?.enabled && item.deadline ? repeatLabel(recurring) : null;
  const section = "border-border border-t border-dashed py-1";

  function run(action: () => void) {
    onClose();
    action();
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
            <p className="text-muted-foreground mt-0.5 font-mono text-[11px]">
              ↺ {repeat} · moves only this time
            </p>
          )}
        </div>
        <BracketButton onClick={onClose} aria-label="close menu" className="-my-1 px-3 py-1.5">
          x
        </BracketButton>
      </div>

      {!readonly && picking && (
        <div className={cn(section, "px-3 pt-1 pb-3")}>
          <BracketButton onClick={() => setPicking(false)} className="mb-1">
            back
          </BracketButton>
          <Calendar
            value={item.deadline ? deadlineDate(item.deadline.toISOString()) : ""}
            onSelect={(date) => run(() => onMove(deadlineOn(date, item.deadline)))}
          />
        </div>
      )}

      {!readonly && !picking && (
        <div className={section}>
          {quickDates(item.deadline).map((option) => {
            const day = formatWeekdayDate(option.at);
            const time = option.allDay ? "all day" : clockTime(option.at);
            return (
              <MenuButton
                key={option.label}
                label={`${option.label} ${day} ${time}`}
                onClick={() => run(() => onMove(option.value))}
              >
                <span className="text-foreground flex-1">{option.label}</span>
                <span className="text-muted-foreground w-20">{day}</span>
                <span className="text-muted-foreground w-14">{time}</span>
              </MenuButton>
            );
          })}
          <MenuButton onClick={() => setPicking(true)}>
            <span className="text-foreground">pick a date…</span>
          </MenuButton>
        </div>
      )}

      <div className={section}>
        <MenuButton onClick={() => void copyTitle()}>
          <span className="text-foreground">copy title</span>
        </MenuButton>
      </div>

      {!readonly && (
        <div className={section}>
          <MenuButton onClick={() => run(onDelete)} className="text-destructive">
            delete
          </MenuButton>
        </div>
      )}
    </>
  );
}

export function ItemMenu({ at, onClose, ...props }: ItemMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const place = () => {
      const { width, height } = menu.getBoundingClientRect();
      const below = at.bottom + MENU_GAP;
      const above = at.top - MENU_GAP - height;
      const top =
        below + height <= window.innerHeight - SCREEN_MARGIN
          ? below
          : above >= SCREEN_MARGIN
            ? above
            : Math.max(SCREEN_MARGIN, window.innerHeight - height - SCREEN_MARGIN);
      const left = Math.max(
        SCREEN_MARGIN,
        Math.min(at.x, window.innerWidth - width - SCREEN_MARGIN)
      );
      setPos({ top, left });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(menu);
    return () => observer.disconnect();
  }, [at]);

  useEffect(() => menuRef.current?.focus(), []);

  const pressedRef = useRef(false);
  const pressGuard = {
    onPointerDownCapture: () => {
      pressedRef.current = true;
    },
    onClickCapture: (e: MouseEvent) => {
      if (e.detail > 0 && !pressedRef.current) {
        e.stopPropagation();
        e.preventDefault();
      }
    },
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <>
      <div
        {...pressGuard}
        className="fixed inset-0 z-30"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        {...pressGuard}
        ref={menuRef}
        role="dialog"
        aria-label={props.item.title}
        tabIndex={-1}
        className="bg-background border-border fixed z-40 max-h-[calc(100dvh-16px)] w-80 max-w-[calc(100vw-16px)] overflow-y-auto border-2 outline-none"
        style={{
          top: pos?.top ?? 0,
          left: pos?.left ?? 0,
          visibility: pos ? "visible" : "hidden",
          boxShadow: "2px 2px 0 var(--border)",
        }}
      >
        <MenuBody {...props} onClose={onClose} />
      </div>
    </>,
    document.body
  );
}

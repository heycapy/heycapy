import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import type { items } from "@/lib/db/schema";
import type { ReminderBadge } from "@/lib/reminders/status";
import type { BucketMember } from "@/lib/buckets/members";
import { MENU_GAP, SCREEN_MARGIN } from "./constants";
import { MenuBody } from "./ItemMenuBody";

type Item = typeof items.$inferSelect;

export type MenuAt = { x: number; top: number; bottom: number };

export type ItemMenuProps = {
  item: Item;
  at: MenuAt;
  readonly: boolean;
  completeLabel: string;
  reminderBadge?: ReminderBadge;
  nextReminderAt?: Date | null;
  // Only in a bucket shared with others
  assign?: { members: BucketMember[]; onAssign: (userId: number | null) => Promise<boolean> };
  onComplete: () => void;
  onMove: (deadline: string) => Promise<void>;
  onDelete: () => void;
  onClose: () => void;
};

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
        className="fixed inset-0 z-[56]"
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
        className="bg-background border-border fixed z-[57] max-h-[calc(100dvh-16px)] w-80 max-w-[calc(100vw-16px)] overflow-y-auto border-2 outline-none"
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

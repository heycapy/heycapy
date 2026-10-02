import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import type { StatusDef } from "@/types/rules";
import { MENU_GAP, SCREEN_MARGIN } from "./constants";

export type StatusAnchor = { top: number; bottom: number; left: number };

export function StatusPicker({
  current,
  statuses,
  anchor,
  onSelect,
  onClose,
}: {
  current: string;
  statuses: StatusDef[];
  anchor: StatusAnchor;
  onSelect: (s: string) => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const { width, height } = menu.getBoundingClientRect();
    const below = anchor.bottom + MENU_GAP;
    const top =
      below + height <= window.innerHeight - SCREEN_MARGIN
        ? below
        : Math.max(SCREEN_MARGIN, anchor.top - height - MENU_GAP);
    const left = Math.min(
      Math.max(SCREEN_MARGIN, anchor.left),
      window.innerWidth - width - SCREEN_MARGIN
    );
    setPos({ top, left });
  }, [anchor]);

  return createPortal(
    <>
      <div className="fixed inset-0 z-[56]" onClick={onClose} />
      <div
        ref={menuRef}
        role="menu"
        aria-label="status"
        className="bg-background border-border fixed z-[57] border-2 py-1"
        style={{
          top: pos?.top ?? 0,
          left: pos?.left ?? 0,
          visibility: pos ? "visible" : "hidden",
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

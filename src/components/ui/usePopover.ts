import { useEffect, useRef, useState } from "react";

// A small panel under (or, near the bottom of the screen, above) its trigger, kept on screen
export function usePopover(size: { width: number; height: number }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    let left = rect.left;
    let top = rect.bottom + 6;
    if (left + size.width > window.innerWidth - 8) left = window.innerWidth - size.width - 8;
    if (top + size.height > window.innerHeight - 8) top = rect.top - size.height - 6;
    setPos({ top: Math.max(8, top), left: Math.max(8, left) });
    setOpen(true);
  }

  return { open, setOpen, toggle, pos, mounted, triggerRef, popoverRef };
}

"use client";

import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Archive, SlidersHorizontal, Trash2 } from "lucide-react";
import { BracketButton } from "@/components/ui/BracketButton";

interface HeaderProps {
  onSettingsOpen: () => void;
  onArchiveOpen: () => void;
  onTrashOpen: () => void;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  if (h >= 17 && h < 22) return "Good evening";
  return "Good night";
}

function getDate() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function GlobalMenu({
  onSettings,
  onArchive,
  onTrash,
}: {
  onSettings: () => void;
  onArchive: () => void;
  onTrash: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  function toggle() {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 6, left: rect.right });
    setOpen((v) => !v);
  }

  function pick(fn: () => void) {
    setOpen(false);
    fn();
  }

  return (
    <>
      <div ref={containerRef}>
        <BracketButton onClick={toggle} className="px-1 py-1.5">
          ···
        </BracketButton>
      </div>

      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <div
              className="bg-background border-border fixed z-40 border-2 py-1"
              style={{
                top: pos.top,
                left: pos.left,
                transform: "translateX(-100%)",
                boxShadow: "2px 2px 0 var(--border)",
              }}
            >
              <button
                onClick={() => pick(onSettings)}
                className="text-foreground hover:bg-muted flex w-full items-center gap-2.5 px-3 py-1.5 font-mono text-xs transition-colors"
              >
                <SlidersHorizontal size={11} />
                tweaks
              </button>
              <button
                onClick={() => pick(onArchive)}
                className="text-foreground hover:bg-muted flex w-full items-center gap-2.5 px-3 py-1.5 font-mono text-xs transition-colors"
              >
                <Archive size={11} />
                archived
              </button>
              <button
                onClick={() => pick(onTrash)}
                className="text-foreground hover:bg-muted flex w-full items-center gap-2.5 px-3 py-1.5 font-mono text-xs transition-colors"
              >
                <Trash2 size={11} />
                trash
              </button>
            </div>
          </>,
          document.body
        )}
    </>
  );
}

export function Header({ onSettingsOpen, onArchiveOpen, onTrashOpen }: HeaderProps) {
  const greeting = useMemo(() => getGreeting(), []);
  const date = useMemo(() => getDate(), []);

  return (
    <header className="flex items-center justify-between px-5 pt-6 pb-2">
      <div>
        <h1 className="font-pixel text-base leading-snug">{greeting}</h1>
        <p className="text-muted-foreground mt-0.5 text-xs">{date}</p>
      </div>

      <div className="flex items-center gap-3">
        <GlobalMenu onSettings={onSettingsOpen} onArchive={onArchiveOpen} onTrash={onTrashOpen} />
      </div>
    </header>
  );
}

"use client";

import { useEffect, useState, useRef, useTransition, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { LogOut, Check } from "lucide-react";
import { logoutAction } from "@/app/(app)/actions";
import { THEMES } from "./settings-constants";

interface Command {
  id: string;
  label: string;
  icon: ReactNode;
  action: () => void;
}

interface Group {
  label: string;
  commands: Command[];
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const { theme, setTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function buildGroups(): Group[] {
    return [
      {
        label: "Appearance",
        commands: THEMES.map((t) => ({
          id: `theme-${t.id}`,
          label: t.label,
          icon: null,
          action: () => {
            setTheme(t.id);
            onClose();
          },
        })),
      },
      {
        label: "Account",
        commands: [
          {
            id: "logout",
            label: "Sign out",
            icon: <LogOut size={14} className="shrink-0" />,
            action: () =>
              startTransition(async () => {
                await logoutAction();
              }),
          },
        ],
      },
    ];
  }

  const allCommands = buildGroups().flatMap((g) => g.commands);

  const filteredGroups: Group[] = query.trim()
    ? [
        {
          label: "Results",
          commands: allCommands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase())),
        },
      ]
    : buildGroups();

  const flatFiltered = filteredGroups.flatMap((g) => g.commands);

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      setQuery("");
      setSelectedId(buildGroups().flatMap((g) => g.commands)[0]?.id ?? "");
      inputRef.current?.focus();
    }, 50);
    return () => clearTimeout(id);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      const idx = flatFiltered.findIndex((c) => c.id === selectedId);

      if (e.key === "ArrowDown" || e.key === "Tab") {
        e.preventDefault();
        const next = flatFiltered[Math.min(idx + 1, flatFiltered.length - 1)];
        if (next) setSelectedId(next.id);
      }
      if (e.key === "ArrowUp" || (e.shiftKey && e.key === "Tab")) {
        e.preventDefault();
        const prev = flatFiltered[Math.max(idx - 1, 0)];
        if (prev) setSelectedId(prev.id);
      }
      if (e.key === "Enter") {
        e.preventDefault();
        flatFiltered[idx]?.action();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, flatFiltered, selectedId, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 z-50 bg-black"
            onClick={onClose}
          />

          <motion.div
            key="palette"
            initial={{ opacity: 0, y: -10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="bg-background border-border fixed top-[18%] left-1/2 z-50 w-full max-w-sm -translate-x-1/2 overflow-hidden border-2"
            style={{ boxShadow: "5px 5px 0 var(--border)" }}
          >
            {/* search bar */}
            <div className="border-border flex items-center gap-2.5 border-b-2 px-3 py-3">
              <span className="text-muted-foreground font-mono text-sm select-none">›</span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  const q = e.target.value;
                  const flat = q.trim()
                    ? allCommands.filter((c) => c.label.toLowerCase().includes(q.toLowerCase()))
                    : buildGroups().flatMap((g) => g.commands);
                  setQuery(q);
                  setSelectedId(flat[0]?.id ?? "");
                }}
                placeholder="Search commands…"
                className="placeholder:text-muted-foreground flex-1 bg-transparent font-mono text-sm outline-none"
                disabled={pending}
              />
              <kbd className="border-border bg-muted text-muted-foreground border px-1.5 py-0.5 font-mono text-[10px]">
                esc
              </kbd>
            </div>

            {/* groups */}
            <div className="max-h-64 overflow-y-auto">
              {flatFiltered.length === 0 && (
                <p className="text-muted-foreground px-4 py-8 text-center font-mono text-xs">
                  Nothing found for &ldquo;{query}&rdquo;
                </p>
              )}

              {filteredGroups.map((group) => {
                if (group.commands.length === 0) return null;
                return (
                  <div key={group.label} className="py-1">
                    {!query.trim() && (
                      <p className="text-muted-foreground px-3 pt-2 pb-0.5 font-mono text-[10px] tracking-widest uppercase select-none">
                        {group.label}
                      </p>
                    )}
                    {group.commands.map((cmd) => {
                      const isSelected = cmd.id === selectedId;
                      const isActiveTheme =
                        cmd.id.startsWith("theme-") && theme === cmd.id.replace("theme-", "");

                      return (
                        <button
                          key={cmd.id}
                          onClick={cmd.action}
                          onMouseEnter={() => setSelectedId(cmd.id)}
                          className={cn(
                            "flex w-full items-center gap-3 px-3 py-2 text-left font-mono text-sm transition-colors",
                            isSelected ? "bg-foreground text-background" : "text-foreground"
                          )}
                        >
                          {cmd.icon && cmd.icon}
                          <span className="flex-1">{cmd.label}</span>
                          {isActiveTheme && <Check size={12} className="opacity-70" />}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div className="border-border flex items-center gap-4 border-t-2 px-3 py-2">
              <span className="text-muted-foreground font-mono text-[10px]">tab navigate</span>
              <span className="text-muted-foreground font-mono text-[10px]">↵ select</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

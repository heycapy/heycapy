"use client";

import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { X, LogOut } from "lucide-react";
import { useTransition } from "react";
import { logoutAction } from "@/app/(app)/actions";

interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
}

const THEMES = [
  { id: "capy", label: "Capy", bg: "#fdf6e3", fg: "#7c4b2a" },
  { id: "gruvbox", label: "Gruvbox", bg: "#282828", fg: "#d79921" },
  { id: "terminal", label: "Terminal", bg: "#000000", fg: "#00ff41" },
] as const;

export function SettingsSheet({ open, onClose }: SettingsSheetProps) {
  const { theme, setTheme } = useTheme();
  const [pending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await logoutAction();
    });
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/30"
            onClick={onClose}
          />
          <motion.aside
            key="sheet"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="bg-background border-border fixed top-0 right-0 z-50 flex h-full w-72 flex-col border-l"
          >
            <div className="flex items-center justify-between border-b px-4 py-4">
              <span className="font-pixel text-sm">Settings</span>
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col gap-6 p-4">
              <div className="flex flex-col gap-2">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Theme
                </p>
                <div className="flex gap-2">
                  {THEMES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      className="flex flex-1 flex-col items-center gap-1.5"
                    >
                      <span
                        className="border-border h-10 w-full rounded border-2 transition-all"
                        style={{
                          background: t.bg,
                          borderColor: theme === t.id ? t.fg : undefined,
                          boxShadow: theme === t.id ? `0 0 0 1px ${t.fg}` : undefined,
                        }}
                      />
                      <span
                        className="text-xs"
                        style={{ color: theme === t.id ? t.fg : undefined }}
                      >
                        {t.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-auto border-t p-4">
              <button
                onClick={handleLogout}
                disabled={pending}
                className="text-muted-foreground hover:text-destructive flex w-full items-center gap-2 rounded px-2 py-2 text-sm transition-colors disabled:opacity-50"
              >
                <LogOut size={15} />
                {pending ? "Signing out…" : "Sign out"}
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2 } from "lucide-react";
import { DatePicker } from "@/components/ui/DatePicker";
import { ITEM_STATUSES } from "./constants";
import type { ItemStatus } from "./constants";
import { cn } from "@/lib/utils";

interface ItemDialogProps {
  open: boolean;
  mode: "add" | "edit";
  title: string;
  deadline: string;
  status: ItemStatus;
  error?: string;
  pending?: boolean;
  onTitleChange: (v: string) => void;
  onDeadlineChange: (v: string) => void;
  onStatusChange: (v: ItemStatus) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}

const BTN =
  "font-mono text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30";
const BTN_D =
  "font-mono text-xs text-muted-foreground transition-colors hover:text-destructive disabled:opacity-30";

export function ItemDialog({
  open,
  mode,
  title,
  deadline,
  status,
  error,
  pending,
  onTitleChange,
  onDeadlineChange,
  onStatusChange,
  onConfirm,
  onCancel,
  onDelete,
}: ItemDialogProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
      el.focus();
    }, 60);
    return () => clearTimeout(id);
  }, [open]);

  function handleTitleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    onTitleChange(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${e.target.scrollHeight}px`;
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.45 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 z-50 bg-black"
            onClick={onCancel}
          />

          <motion.div
            key="dialog"
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed top-[22%] left-1/2 z-50 w-full max-w-xs -translate-x-1/2"
            style={{ boxShadow: "5px 5px 0 var(--border)" }}
          >
            <div className="border-border bg-background overflow-hidden border-2">
              <div className="bg-foreground text-background flex items-center justify-between px-3 py-1.5">
                <span className="font-pixel text-xs">
                  {mode === "add" ? "new item" : "edit item"}
                </span>
                <button
                  onClick={onCancel}
                  className="font-mono text-xs opacity-60 transition-opacity hover:opacity-100"
                >
                  <span className="opacity-50">[</span>x<span className="opacity-50">]</span>
                </button>
              </div>

              <div className="flex flex-col gap-4 px-4 py-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-muted-foreground font-mono text-[10px]">title</label>
                  <textarea
                    ref={textareaRef}
                    value={title}
                    onChange={handleTitleChange}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && title.trim()) {
                        e.preventDefault();
                        onConfirm();
                      }
                      if (e.key === "Escape") onCancel();
                    }}
                    placeholder={error || "What needs doing?"}
                    disabled={pending}
                    rows={1}
                    className={cn(
                      "border-border w-full resize-none overflow-hidden border bg-transparent px-2 py-1.5 text-sm outline-none disabled:opacity-50",
                      error ? "placeholder:text-destructive" : "placeholder:text-muted-foreground"
                    )}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-muted-foreground font-mono text-[10px]">deadline</label>
                  <DatePicker value={deadline} onChange={onDeadlineChange} disabled={pending} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-muted-foreground font-mono text-[10px]">status</label>
                  <div className="flex flex-wrap gap-1.5">
                    {ITEM_STATUSES.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => onStatusChange(s.value)}
                        disabled={pending}
                        className={cn(
                          "flex items-center gap-1.5 border px-2 py-1 font-mono text-[10px] transition-colors disabled:opacity-40",
                          status === s.value
                            ? "bg-foreground text-background border-foreground"
                            : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                        )}
                      >
                        <span className={cn("h-1.5 w-1.5 rounded-full", s.color)} />
                        {s.value}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-border flex items-center justify-between border-t px-3 py-2.5">
                {onDelete ? (
                  <button onClick={onDelete} disabled={pending} className={BTN_D}>
                    <Trash2 size={12} />
                  </button>
                ) : (
                  <span />
                )}
                <button onClick={onConfirm} disabled={!title.trim() || pending} className={BTN}>
                  <span className="opacity-50">[</span>
                  {mode === "add" ? "add" : "update"}
                  <span className="opacity-50">]</span>
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

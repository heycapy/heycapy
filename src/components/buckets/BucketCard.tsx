"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { buckets, items as itemsTable } from "@/lib/db/schema";

type BucketRow = typeof buckets.$inferSelect;
type ItemRow = typeof itemsTable.$inferSelect;

interface BucketCardProps {
  bucket: BucketRow;
  items: ItemRow[];
}

function relativeTime(deadline: Date): string {
  const days = Math.floor((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  return `${days}d`;
}

function formatDate(deadline: Date): string {
  return deadline.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function BucketCard({ bucket, items }: BucketCardProps) {
  const [expanded, setExpanded] = useState(false);

  const activeItems = items.filter((item) => item.status === "active");
  const nextItem = items
    .filter(
      (item): item is ItemRow & { deadline: Date } =>
        item.status === "active" && item.deadline !== null
    )
    .sort((a, b) => a.deadline.getTime() - b.deadline.getTime())[0];

  const accentColor = bucket.color ?? "var(--primary)";

  return (
    <div className="border-border bg-card flex overflow-hidden rounded border">
      <div className="w-[3px] shrink-0" style={{ backgroundColor: accentColor }} />

      <div className="flex min-w-0 flex-1 flex-col">
        <button
          className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
          onClick={() => setExpanded((v) => !v)}
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-pixel text-sm">{bucket.name}</span>
            {!expanded && nextItem && (
              <p
                className={cn(
                  "truncate font-mono text-xs",
                  relativeTime(nextItem.deadline) === "overdue"
                    ? "text-destructive"
                    : "text-muted-foreground"
                )}
              >
                Next: {nextItem.title} — {relativeTime(nextItem.deadline)}
              </p>
            )}
          </div>

          {expanded ? (
            <div className="flex shrink-0 items-center gap-3" onClick={(e) => e.stopPropagation()}>
              {/* TODO: PRE-72 — add item */}
              <button className="text-muted-foreground hover:text-foreground transition-colors">
                <Plus size={14} />
              </button>
              {/* TODO: bucket settings */}
              <button className="text-muted-foreground hover:text-foreground transition-colors">
                <Settings size={13} />
              </button>
            </div>
          ) : (
            <span className="text-muted-foreground shrink-0 font-mono text-xs">
              {activeItems.length} {activeItems.length === 1 ? "item" : "items"}
            </span>
          )}
        </button>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="border-border border-t">
                {items.length === 0 ? (
                  <p className="text-muted-foreground px-3 py-4 text-center text-xs">
                    No items yet.
                  </p>
                ) : (
                  items.map((item) => {
                    const isCompleted = item.status === "completed";
                    const rel = item.deadline ? relativeTime(item.deadline) : null;

                    return (
                      <div
                        key={item.id}
                        className="border-border flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0"
                      >
                        <span
                          className={cn(
                            "flex-1 text-sm",
                            isCompleted && "text-muted-foreground line-through"
                          )}
                        >
                          {item.title}
                        </span>
                        {item.deadline && rel && (
                          <div className="flex shrink-0 items-center gap-2 font-mono text-xs">
                            <span className="text-muted-foreground">
                              {formatDate(item.deadline)}
                            </span>
                            <span
                              className={cn(
                                rel === "overdue" ? "text-destructive" : "text-muted-foreground"
                              )}
                            >
                              {rel}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

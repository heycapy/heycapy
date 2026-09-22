"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddItemForm } from "./AddItemForm";
import { ItemRow } from "./ItemRow";
import type { buckets, items as itemsTable } from "@/lib/db/schema";

type BucketRow = typeof buckets.$inferSelect;
type Item = typeof itemsTable.$inferSelect;

interface BucketCardProps {
  bucket: BucketRow;
  items: Item[];
}

function relativeTime(deadline: Date): string {
  const days = Math.floor((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  return `${days}d`;
}

export function BucketCard({ bucket, items }: BucketCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [addingItem, setAddingItem] = useState(false);

  const activeItems = items.filter((item) => item.status === "active");
  const nextItem = items
    .filter(
      (item): item is Item & { deadline: Date } =>
        item.status === "active" && item.deadline !== null
    )
    .sort((a, b) => a.deadline.getTime() - b.deadline.getTime())[0];

  return (
    <div
      className="border-border bg-card overflow-hidden rounded-sm border-2"
      style={{ boxShadow: "3px 3px 0 var(--border)" }}
    >
      <button
        className="flex w-full items-start justify-between gap-4 px-4 py-3.5 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-baseline gap-1.5">
            <span className="font-pixel text-sm leading-snug">{bucket.name}</span>
            <span className="text-muted-foreground/40 font-mono text-[10px]">#{bucket.id}</span>
          </span>
          {!expanded && nextItem && (
            <p
              className={cn(
                "truncate font-mono text-xs",
                relativeTime(nextItem.deadline) === "overdue"
                  ? "text-destructive"
                  : "text-muted-foreground"
              )}
            >
              ↳ {nextItem.title} · {relativeTime(nextItem.deadline)}
            </p>
          )}
          {!expanded && !nextItem && activeItems.length === 0 && (
            <p className="text-muted-foreground font-mono text-xs">empty</p>
          )}
        </div>

        {expanded ? (
          <div
            className="flex shrink-0 items-center gap-3 pt-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setAddingItem((v) => !v)}
            >
              <Plus size={14} />
            </button>
            <button className="text-muted-foreground hover:text-foreground transition-colors">
              <Settings size={13} />
            </button>
          </div>
        ) : (
          <span className="font-pixel text-muted-foreground/50 shrink-0 text-2xl leading-none">
            {activeItems.length}
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
            <div className="border-border border-t-2">
              <AnimatePresence initial={false}>
                {addingItem && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.14 }}
                    className="overflow-hidden"
                  >
                    <AddItemForm bucketId={bucket.id} onClose={() => setAddingItem(false)} />
                  </motion.div>
                )}
              </AnimatePresence>

              {items.length === 0 && !addingItem ? (
                <p className="text-muted-foreground px-4 py-4 text-center font-mono text-xs">
                  no items yet
                </p>
              ) : (
                items.map((item) => <ItemRow key={item.id} item={item} />)
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

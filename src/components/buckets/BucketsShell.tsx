"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Archive, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { BucketContent } from "./BucketContent";
import { ArchivedBucketsSheet } from "./ArchivedBucketsSheet";
import { TrashSheet } from "./TrashSheet";
import { BUCKET_PALETTE } from "./constants";
import { useUIStore } from "@/store/ui";
import type { buckets } from "@/lib/db/schema";

type BucketRow = typeof buckets.$inferSelect;

interface BucketsShellProps {
  buckets: BucketRow[];
}

export function BucketsShell({ buckets }: BucketsShellProps) {
  const [activeId, setActiveId] = useState<number>(buckets[0]?.id ?? -1);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const openCreateBucket = useUIStore((s) => s.openCreateBucket);
  const prevBucketsRef = useRef<BucketRow[]>(buckets);

  useEffect(() => {
    const stillExists = buckets.some((b) => b.id === activeId);
    if (!stillExists && buckets.length > 0) {
      const prevIndex = prevBucketsRef.current.findIndex((b) => b.id === activeId);
      const nextIndex = Math.min(prevIndex, buckets.length - 1);
      setActiveId(buckets[Math.max(nextIndex, 0)].id);
    }
    prevBucketsRef.current = buckets;
  }, [buckets, activeId]);

  const activeBucket = buckets.find((b) => b.id === activeId) ?? buckets[0];
  const activeIndex = buckets.findIndex((b) => b.id === activeId);
  const accentColor = BUCKET_PALETTE[Math.max(activeIndex, 0) % BUCKET_PALETTE.length];

  if (!activeBucket) return null; // page.tsx shows BucketsEmptyState instead

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 overflow-y-auto pb-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeBucket.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            <BucketContent bucket={activeBucket} accentColor={accentColor} />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="border-border bg-background sticky bottom-0 border-t-2">
        <div className="scrollbar-hide flex overflow-x-auto">
          {buckets.map((bucket, i) => {
            const isActive = bucket.id === activeId;
            const color = BUCKET_PALETTE[i % BUCKET_PALETTE.length];

            return (
              <button
                key={bucket.id}
                onClick={() => setActiveId(bucket.id)}
                style={isActive ? { borderTopColor: color } : undefined}
                className={cn(
                  "-mt-0.5 shrink-0 border-t-2 px-3 py-2.5 text-left whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-card text-foreground"
                    : "text-muted-foreground hover:text-foreground border-t-transparent"
                )}
              >
                <span className="font-pixel text-xs">{bucket.name}</span>
              </button>
            );
          })}

          <button
            onClick={openCreateBucket}
            className="text-muted-foreground hover:text-foreground -mt-0.5 shrink-0 border-t-2 border-t-transparent px-3 py-2.5 transition-colors"
          >
            <Plus size={12} />
          </button>
          <button
            onClick={() => setArchivedOpen(true)}
            className="text-muted-foreground hover:text-foreground -mt-0.5 shrink-0 border-t-2 border-t-transparent px-3 py-2.5 transition-colors"
          >
            <Archive size={12} />
          </button>
          <button
            onClick={() => setTrashOpen(true)}
            className="text-muted-foreground hover:text-foreground -mt-0.5 shrink-0 border-t-2 border-t-transparent px-3 py-2.5 transition-colors"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <ArchivedBucketsSheet open={archivedOpen} onClose={() => setArchivedOpen(false)} />
      <TrashSheet open={trashOpen} onClose={() => setTrashOpen(false)} />
    </div>
  );
}

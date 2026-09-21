"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { BucketContent } from "./BucketContent";
import { BUCKET_PALETTE } from "./constants";
import { useUIStore } from "@/store/ui";
import type { buckets } from "@/lib/db/schema";

type BucketRow = typeof buckets.$inferSelect;

interface BucketsShellProps {
  buckets: BucketRow[];
}

export function BucketsShell({ buckets }: BucketsShellProps) {
  const [activeId, setActiveId] = useState<number>(buckets[0]?.id ?? -1);
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
        {/* Mobile: styled tab look with native select interaction */}
        <div className="flex items-center md:hidden">
          <button
            onClick={openCreateBucket}
            className="text-muted-foreground hover:text-foreground -mt-0.5 shrink-0 border-t-2 border-t-transparent px-3 py-2.5 transition-colors"
            aria-label="New bucket"
          >
            <Plus size={13} />
          </button>
          <div className="relative -mt-0.5 min-w-0 flex-1">
            <div
              className="bg-card pointer-events-none border-t-2 px-3 py-2.5"
              style={{ borderTopColor: accentColor }}
            >
              <span className="font-pixel text-foreground block truncate text-xs">
                {activeBucket.icon
                  ? `${activeBucket.icon} ${activeBucket.name}`
                  : activeBucket.name}
              </span>
            </div>
            <select
              value={activeId}
              onChange={(e) => setActiveId(Number(e.target.value))}
              className="absolute inset-0 w-full cursor-pointer opacity-0"
              aria-label="Select bucket"
            >
              {buckets.map((bucket) => (
                <option key={bucket.id} value={bucket.id}>
                  {bucket.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Desktop: tab bar */}
        <div className="scrollbar-hide hidden overflow-x-auto md:flex">
          <button
            onClick={openCreateBucket}
            className="text-muted-foreground hover:text-foreground -mt-0.5 shrink-0 border-t-2 border-t-transparent px-3 py-2.5 transition-colors"
            aria-label="New bucket"
          >
            <Plus size={12} />
          </button>
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
                <span className="font-pixel text-xs">
                  {bucket.icon ? `${bucket.icon} ${bucket.name}` : bucket.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

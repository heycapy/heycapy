"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Drawer } from "vaul";
import { Check, ChevronDown } from "lucide-react";
import { BracketButton } from "@/components/ui/BracketButton";
import { cn } from "@/lib/utils";
import { BucketContent } from "./BucketContent";
import { BUCKET_PALETTE } from "./constants";
import { useUIStore } from "@/store/ui";
import { saveTimezoneIfDefaultAction } from "@/app/(app)/user-settings-actions";
import type { buckets } from "@/lib/db/schema";

type BucketRow = typeof buckets.$inferSelect;

type BucketsShellProps = {
  buckets: BucketRow[];
};

function MobileBucketPicker({
  buckets,
  open,
  activeId,
  onSelect,
  onClose,
}: {
  buckets: BucketRow[];
  open: boolean;
  activeId: number;
  onSelect: (id: number) => void;
  onClose: () => void;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={(v) => !v && onClose()} shouldScaleBackground={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Drawer.Content className="bg-background border-border fixed inset-x-0 bottom-0 z-50 flex flex-col border-t-2 outline-none">
          <div className="mx-auto mt-2 mb-1 h-1 w-8 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-600" />
          <Drawer.Title className="font-pixel text-muted-foreground px-4 pt-1 pb-3 text-[10px]">
            switch bucket
          </Drawer.Title>
          <div className="border-border max-h-[60vh] overflow-y-auto border-t">
            {buckets.map((bucket, i) => {
              const isActive = bucket.id === activeId;
              const color = BUCKET_PALETTE[i % BUCKET_PALETTE.length];
              return (
                <button
                  key={bucket.id}
                  onClick={() => {
                    onSelect(bucket.id);
                    onClose();
                  }}
                  className={cn(
                    "border-border flex w-full items-center gap-3 border-b px-4 py-3.5 text-left transition-colors last:border-b-0",
                    isActive ? "bg-card" : "hover:bg-muted"
                  )}
                >
                  <span
                    className="mt-0.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="font-pixel text-foreground flex-1 truncate text-xs">
                    {bucket.icon ? `${bucket.icon} ${bucket.name}` : bucket.name}
                  </span>
                  {isActive && <Check size={12} className="text-foreground shrink-0" />}
                </button>
              );
            })}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

export function BucketsShell({ buckets: rawBuckets }: BucketsShellProps) {
  const buckets = rawBuckets.filter((b, i, arr) => arr.findIndex((x) => x.id === b.id) === i);
  const openCreateBucket = useUIStore((s) => s.openCreateBucket);
  const activeBucketId = useUIStore((s) => s.activeBucketId);
  const setActiveBucketId = useUIStore((s) => s.setActiveBucketId);
  const prevBucketsRef = useRef<BucketRow[]>(buckets);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    void saveTimezoneIfDefaultAction(tz);
  }, []);

  const activeId =
    activeBucketId !== null && buckets.some((b) => b.id === activeBucketId)
      ? activeBucketId
      : (buckets[0]?.id ?? -1);

  useEffect(() => {
    if (activeBucketId === null) return;
    const stillExists = buckets.some((b) => b.id === activeBucketId);
    const prevIndex = prevBucketsRef.current.findIndex((b) => b.id === activeBucketId);
    // prevIndex === -1 means the bucket was just created and hasn't arrived yet, not removed
    if (!stillExists && prevIndex !== -1 && buckets.length > 0) {
      setActiveBucketId(buckets[Math.min(prevIndex, buckets.length - 1)].id);
    }
    prevBucketsRef.current = buckets;
  }, [buckets, activeBucketId, setActiveBucketId]);

  const activeBucket = buckets.find((b) => b.id === activeId) ?? buckets[0];
  const activeIndex = buckets.findIndex((b) => b.id === activeId);
  const accentColor = BUCKET_PALETTE[Math.max(activeIndex, 0) % BUCKET_PALETTE.length];

  if (!activeBucket) return null;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 overflow-y-auto pb-[420px]">
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
        {/* Mobile: custom picker */}
        <div className="flex items-center md:hidden">
          <BracketButton onClick={openCreateBucket} className="shrink-0 px-3 py-3.5">
            add bucket
          </BracketButton>
          <button onClick={() => setPickerOpen(true)} className="-mt-0.5 min-w-0 flex-1">
            <div
              className="bg-card flex items-center justify-between gap-2 border-t-2 px-3 py-3.5"
              style={{ borderTopColor: accentColor }}
            >
              <span className="font-pixel text-foreground block truncate text-xs">
                {activeBucket.icon
                  ? `${activeBucket.icon} ${activeBucket.name}`
                  : activeBucket.name}
              </span>
              <ChevronDown size={11} className="text-muted-foreground shrink-0" />
            </div>
          </button>
        </div>

        {/* Desktop: tab bar */}
        <div className="scrollbar-hide hidden overflow-x-auto md:flex">
          <BracketButton onClick={openCreateBucket} className="shrink-0 px-3 py-[13.8px]">
            add bucket
          </BracketButton>
          {buckets.map((bucket, i) => {
            const isActive = bucket.id === activeId;
            const color = BUCKET_PALETTE[i % BUCKET_PALETTE.length];

            return (
              <button
                key={bucket.id}
                onClick={() => setActiveBucketId(bucket.id)}
                style={isActive ? { borderTopColor: color } : undefined}
                className={cn(
                  "-mt-0.5 max-w-[140px] shrink-0 border-t-2 px-3 py-[13.8px] text-left transition-colors",
                  isActive
                    ? "bg-card text-foreground"
                    : "text-muted-foreground hover:text-foreground border-t-transparent"
                )}
              >
                <span className="font-pixel block truncate text-xs">
                  {bucket.icon ? `${bucket.icon} ${bucket.name}` : bucket.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <MobileBucketPicker
        open={pickerOpen}
        buckets={buckets}
        activeId={activeId}
        onSelect={setActiveBucketId}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
}

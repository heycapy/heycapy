"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Clock } from "lucide-react";
import { BracketButton } from "@/components/ui/BracketButton";
import { cn } from "@/lib/utils";
import { BucketContent } from "./BucketContent";
import { PlacePicker } from "./PlacePicker";
import { Sprite } from "@/components/capy/Sprite";
import { TodayView } from "@/components/today/TodayView";
import { BUCKET_PALETTE } from "./constants";
import { useUIStore } from "@/store/ui";
import { useLayoutStore } from "@/store/layout";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { parseItemsRules } from "@/lib/rules";
import { BOTTOM_BAR_MEDIA_QUERY } from "@/constants";
import { saveTimezoneIfDefaultAction } from "@/app/(app)/user-settings-actions";
import type { buckets } from "@/lib/db/schema";

type BucketRow = typeof buckets.$inferSelect;

type BucketsShellProps = {
  buckets: BucketRow[];
  focusBucketId?: number | null;
};

function TodayButton({
  active,
  onClick,
  className,
}: {
  active: boolean;
  onClick: () => void;
  className: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex shrink-0 items-center gap-1.5 border-t-2 px-3 font-mono text-xs transition-colors",
        active
          ? "bg-card text-foreground border-t-foreground"
          : "text-muted-foreground hover:text-foreground border-t-transparent",
        className
      )}
    >
      <Clock size={12} aria-hidden />
      today
    </button>
  );
}

export function BucketsShell({ buckets: rawBuckets, focusBucketId = null }: BucketsShellProps) {
  const buckets = rawBuckets.filter((b, i, arr) => arr.findIndex((x) => x.id === b.id) === i);
  const openCreateBucket = useUIStore((s) => s.openCreateBucket);
  const setChatState = useLayoutStore((s) => s.setChatState);
  const setBottomBarShown = useLayoutStore((s) => s.setBottomBarShown);
  const setSearchOpen = useLayoutStore((s) => s.setSearchOpen);
  const activeBucketId = useUIStore((s) => s.activeBucketId);
  const setActiveBucketId = useUIStore((s) => s.setActiveBucketId);
  const newBucketId = useUIStore((s) => s.newBucketId);
  const clearNewBucket = useUIStore((s) => s.clearNewBucket);
  const todayOpen = useUIStore((s) => s.todayOpen);
  const openToday = useUIStore((s) => s.openToday);
  // The open view is remembered per session; wait for it rather than flash the default
  const hydrated = useSyncExternalStore(
    (onChange) => useUIStore.persist.onFinishHydration(onChange),
    () => useUIStore.persist.hasHydrated(),
    () => false
  );
  const prevBucketsRef = useRef<BucketRow[]>(buckets);
  const [pickerOpen, setPickerOpen] = useState(false);
  const addItemRef = useRef<(() => void) | null>(null);
  const hasBottomBar = useMediaQuery(BOTTOM_BAR_MEDIA_QUERY);

  useEffect(() => {
    setBottomBarShown(true);
    return () => setBottomBarShown(false);
  }, [setBottomBarShown]);

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    void saveTimezoneIfDefaultAction(tz);
  }, []);

  useEffect(() => {
    if (focusBucketId === null) return;
    setActiveBucketId(focusBucketId);
    // Keep the #item anchor, drop ?bucket so a reload doesn't jump back
    window.history.replaceState(null, "", `/${window.location.hash}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (newBucketId === null || !buckets.some((b) => b.id === newBucketId)) return;
    setActiveBucketId(newBucketId);
    clearNewBucket();
  }, [buckets, newBucketId, setActiveBucketId, clearNewBucket]);

  const activeId =
    activeBucketId !== null && buckets.some((b) => b.id === activeBucketId)
      ? activeBucketId
      : (buckets[0]?.id ?? -1);

  useEffect(() => {
    if (activeBucketId === null) return;
    const stillExists = buckets.some((b) => b.id === activeBucketId);
    const prevIndex = prevBucketsRef.current.findIndex((b) => b.id === activeBucketId);
    if (!stillExists && prevIndex !== -1 && buckets.length > 0) {
      useUIStore.setState({ activeBucketId: buckets[Math.min(prevIndex, buckets.length - 1)].id });
    }
    prevBucketsRef.current = buckets;
  }, [buckets, activeBucketId, setActiveBucketId]);

  const activeBucket = buckets.find((b) => b.id === activeId) ?? buckets[0];
  const activeIndex = buckets.findIndex((b) => b.id === activeId);
  const accentColor = BUCKET_PALETTE[Math.max(activeIndex, 0) % BUCKET_PALETTE.length];
  const placeColor = todayOpen ? "var(--foreground)" : accentColor;

  if (!activeBucket) return null;

  const canAddItem = todayOpen
    ? buckets.some((b) => parseItemsRules(b.itemsRules).readonly !== true)
    : parseItemsRules(activeBucket.itemsRules).readonly !== true;

  function addItem() {
    addItemRef.current?.();
  }

  return (
    <div className="flex flex-1 flex-col">
      <div
        className="flex-1 overflow-y-auto pb-[420px]"
        onClick={(e) => {
          if (hasBottomBar && canAddItem && e.target === e.currentTarget) addItem();
        }}
      >
        {hydrated && (
          <AnimatePresence mode="wait">
            <motion.div
              key={todayOpen ? "today" : activeBucket.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              {todayOpen ? (
                <TodayView buckets={buckets} addItemRef={addItemRef} />
              ) : (
                <BucketContent
                  bucket={activeBucket}
                  accentColor={accentColor}
                  addItemRef={addItemRef}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      <div className="border-border bg-background sticky bottom-0 border-t-2 md:border-t-0">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden">
          <button
            onClick={() => setPickerOpen(true)}
            aria-haspopup="dialog"
            className="flex min-h-14 min-w-0 items-center pr-1 pl-4"
          >
            <span
              style={{ backgroundColor: `color-mix(in oklab, ${placeColor} 18%, transparent)` }}
              className="flex h-10 max-w-28 min-w-0 items-center gap-1 px-2"
            >
              {todayOpen && <Clock size={13} className="shrink-0" aria-hidden />}
              <span className="font-pixel text-foreground truncate text-sm">
                {todayOpen
                  ? "today"
                  : activeBucket.icon
                    ? `${activeBucket.icon} ${activeBucket.name}`
                    : activeBucket.name}
              </span>
              <ChevronDown size={13} className="text-muted-foreground shrink-0" aria-hidden />
            </span>
          </button>
          <div className="flex justify-center">
            {canAddItem && (
              <BracketButton
                onClick={addItem}
                style={{ color: accentColor }}
                className="min-h-14 px-3 text-base"
              >
                add +
              </BracketButton>
            )}
          </div>
          <div className="flex min-w-0 items-stretch justify-between">
            <BracketButton onClick={() => setSearchOpen(true)} className="min-h-14 px-1 text-sm">
              search
            </BracketButton>
            <button
              onClick={() => setChatState("open")}
              aria-label="chat with capy"
              className="flex min-h-14 shrink-0 items-center pr-3 pl-1 transition-transform active:scale-95"
            >
              <Sprite id="capy-idle-blink" size={44} />
            </button>
          </div>
        </div>

        <div className="scrollbar-hide hidden overflow-x-auto shadow-[inset_0_2px_0_var(--border)] md:flex">
          <BracketButton onClick={openCreateBucket} className="shrink-0 px-3 py-[13.8px]">
            add bucket
          </BracketButton>
          <TodayButton active={todayOpen} onClick={openToday} className="py-[13.8px]" />
          <span aria-hidden className="bg-border my-2.5 w-0.5 shrink-0" />
          {buckets.map((bucket, i) => {
            const isActive = !todayOpen && bucket.id === activeId;
            const color = BUCKET_PALETTE[i % BUCKET_PALETTE.length];

            return (
              <button
                key={bucket.id}
                onClick={() => setActiveBucketId(bucket.id)}
                style={isActive ? { borderTopColor: color } : undefined}
                className={cn(
                  "max-w-[140px] shrink-0 border-t-2 px-3 py-[13.8px] text-left transition-colors",
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

      <PlacePicker
        open={pickerOpen}
        buckets={buckets}
        todayOpen={todayOpen}
        activeId={activeId}
        onSelectToday={openToday}
        onSelectBucket={setActiveBucketId}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
}

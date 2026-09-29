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
        "-mt-0.5 flex shrink-0 items-center gap-1.5 border-t-2 px-3 font-mono text-xs transition-colors",
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
  const activeBucketId = useUIStore((s) => s.activeBucketId);
  const setActiveBucketId = useUIStore((s) => s.setActiveBucketId);
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
    // Only on arrival; the rest of the visit uses the normal bucket switcher
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      useUIStore.setState({ activeBucketId: buckets[Math.min(prevIndex, buckets.length - 1)].id });
    }
    prevBucketsRef.current = buckets;
  }, [buckets, activeBucketId, setActiveBucketId]);

  const activeBucket = buckets.find((b) => b.id === activeId) ?? buckets[0];
  const activeIndex = buckets.findIndex((b) => b.id === activeId);
  const accentColor = BUCKET_PALETTE[Math.max(activeIndex, 0) % BUCKET_PALETTE.length];

  if (!activeBucket) return null;

  const canAddItem = !todayOpen && parseItemsRules(activeBucket.itemsRules).readonly !== true;

  function addItem() {
    addItemRef.current?.();
  }

  return (
    <div className="flex flex-1 flex-col">
      <div
        className="flex-1 overflow-y-auto pb-[420px]"
        // Only the empty space under the list is the container itself
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
                <TodayView />
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

      <div className="border-border bg-background sticky bottom-0 border-t-2">
        {/* Mobile: place switcher · add · capy */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-stretch md:hidden">
          <button
            onClick={() => setPickerOpen(true)}
            aria-haspopup="dialog"
            style={{ borderTopColor: todayOpen ? undefined : accentColor }}
            className={cn(
              "bg-card -mt-0.5 flex min-w-0 items-center gap-2 border-t-2 py-3.5 pr-2 pl-3 text-left",
              todayOpen && "border-t-foreground"
            )}
          >
            {todayOpen ? (
              <Clock size={12} className="text-foreground shrink-0" aria-hidden />
            ) : (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: accentColor }}
              />
            )}
            <span className="font-pixel text-foreground truncate text-xs">
              {todayOpen
                ? "today"
                : activeBucket.icon
                  ? `${activeBucket.icon} ${activeBucket.name}`
                  : activeBucket.name}
            </span>
            <ChevronDown size={11} className="text-muted-foreground shrink-0" aria-hidden />
          </button>
          <div className="flex justify-center">
            {canAddItem && (
              <BracketButton
                onClick={addItem}
                style={{ color: accentColor }}
                className="px-4 py-3 text-sm"
              >
                add +
              </BracketButton>
            )}
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => setChatState("open")}
              aria-label="chat with capy"
              className="flex items-center px-3 transition-transform active:scale-95"
            >
              <Sprite id="capy-idle-blink" size={44} />
            </button>
          </div>
        </div>

        {/* Desktop: tab bar */}
        <div className="scrollbar-hide hidden overflow-x-auto md:flex">
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

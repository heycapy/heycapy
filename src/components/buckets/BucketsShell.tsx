"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Drawer } from "vaul";
import { Check, ChevronDown, Clock, Plus } from "lucide-react";
import { BracketButton } from "@/components/ui/BracketButton";
import { cn } from "@/lib/utils";
import { BucketContent } from "./BucketContent";
import { TodayView } from "@/components/today/TodayView";
import { BUCKET_PALETTE } from "./constants";
import { useUIStore } from "@/store/ui";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { parseItemsRules } from "@/lib/rules";
import { BOTTOM_BAR_MEDIA_QUERY, MOBILE_MEDIA_QUERY } from "@/constants";
import { saveTimezoneIfDefaultAction } from "@/app/(app)/user-settings-actions";
import type { buckets } from "@/lib/db/schema";

type BucketRow = typeof buckets.$inferSelect;

type BucketsShellProps = {
  buckets: BucketRow[];
  // From a notification link: show this bucket first
  focusBucketId?: number | null;
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
  const openCreateBucket = useUIStore((s) => s.openCreateBucket);

  return (
    <Drawer.Root open={open} onOpenChange={(v) => !v && onClose()} shouldScaleBackground={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Drawer.Content className="bg-background border-border fixed inset-x-0 bottom-0 z-50 flex flex-col border-t-2 outline-none">
          <div className="mx-auto mt-2 mb-1 h-1 w-8 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-600" />
          <Drawer.Title className="font-pixel text-muted-foreground px-4 pt-1 pb-3 text-xs">
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
            <button
              onClick={() => {
                onClose();
                openCreateBucket();
              }}
              className="text-muted-foreground hover:bg-muted hover:text-foreground flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors"
            >
              <Plus size={12} className="shrink-0" aria-hidden />
              <span className="font-mono text-xs">new bucket</span>
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

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
  const keyboardStandInRef = useRef<HTMLInputElement>(null);
  const isMobile = useMediaQuery(MOBILE_MEDIA_QUERY);
  const hasBottomBar = useMediaQuery(BOTTOM_BAR_MEDIA_QUERY);

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
    const startAdding = addItemRef.current;
    if (!startAdding) return;
    // iOS raises the keyboard only for a focus() inside the tap itself, and the sheet's
    // input doesn't exist yet: this input holds the keyboard until the sheet takes it over
    if (isMobile) keyboardStandInRef.current?.focus();
    startAdding();
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
        {/* Mobile: custom picker */}
        <div className="flex items-stretch md:hidden">
          <TodayButton active={todayOpen} onClick={openToday} className="py-3.5" />
          <div
            className={cn(
              "-mt-0.5 flex min-w-0 flex-1 items-stretch border-t-2",
              todayOpen ? "border-t-transparent" : "bg-card"
            )}
            style={todayOpen ? undefined : { borderTopColor: accentColor }}
          >
            <button
              onClick={() => (todayOpen ? setActiveBucketId(activeBucket.id) : setPickerOpen(true))}
              className="min-w-0 flex-1 py-3.5 pl-3 text-left"
            >
              <span
                className={cn(
                  "font-pixel block truncate text-xs",
                  todayOpen ? "text-muted-foreground" : "text-foreground"
                )}
              >
                {activeBucket.icon
                  ? `${activeBucket.icon} ${activeBucket.name}`
                  : activeBucket.name}
              </span>
            </button>
            <button
              onClick={() => setPickerOpen(true)}
              aria-label="choose bucket"
              className="text-muted-foreground shrink-0 px-3"
            >
              <ChevronDown size={11} aria-hidden />
            </button>
          </div>
          {canAddItem && (
            <BracketButton
              onClick={addItem}
              style={{ color: accentColor }}
              className="shrink-0 px-4 py-3.5"
            >
              add +
            </BracketButton>
          )}
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

      <input
        ref={keyboardStandInRef}
        aria-hidden
        tabIndex={-1}
        className="pointer-events-none fixed bottom-0 left-0 h-px w-px text-base opacity-0"
      />

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

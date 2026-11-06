"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BucketContent, type BucketView } from "./BucketContent";
import { BucketTabs } from "./BucketTabs";
import { BucketsFooter } from "./BucketsFooter";
import { TodayView } from "@/components/today/TodayView";
import { Banners } from "@/components/layout/Banners";
import { BUCKET_PALETTE, VIEW_FADE } from "./constants";
import { useUIStore } from "@/store/ui";
import { useLayoutStore } from "@/store/layout";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { parseItemsRules } from "@/lib/rules";
import { BOTTOM_BAR_MEDIA_QUERY } from "@/constants";
import type { ViewerBucket } from "@/lib/buckets/access";

const writable = (bucket: ViewerBucket) => parseItemsRules(bucket.itemsRules).readonly !== true;

type BucketsShellProps = {
  buckets: ViewerBucket[];
  focusBucketId?: number | null;
};

export function BucketsShell({ buckets: rawBuckets, focusBucketId = null }: BucketsShellProps) {
  const buckets = rawBuckets.filter((b, i, arr) => arr.findIndex((x) => x.id === b.id) === i);
  const setBottomBarShown = useLayoutStore((s) => s.setBottomBarShown);
  const activeBucketId = useUIStore((s) => s.activeBucketId);
  const setActiveBucketId = useUIStore((s) => s.setActiveBucketId);
  const newBucketId = useUIStore((s) => s.newBucketId);
  const clearNewBucket = useUIStore((s) => s.clearNewBucket);
  const todayOpen = useUIStore((s) => s.todayOpen);
  // The open view is remembered per session, wait for it rather than flash the default
  const hydrated = useSyncExternalStore(
    (onChange) => useUIStore.persist.onFinishHydration(onChange),
    () => useUIStore.persist.hasHydrated(),
    () => false
  );
  const prevBucketsRef = useRef<ViewerBucket[]>(buckets);
  const viewRef = useRef<BucketView | null>(null);
  const quickAddRef = useRef<HTMLInputElement>(null);
  const focusPending = useRef(false);
  const expandPending = useRef(false);
  const [panelSlot, setPanelSlot] = useState<HTMLDivElement | null>(null);
  const hasBottomBar = useMediaQuery(BOTTOM_BAR_MEDIA_QUERY);

  useEffect(() => {
    setBottomBarShown(true);
    return () => setBottomBarShown(false);
  }, [setBottomBarShown]);

  useEffect(() => {
    if (focusBucketId === null) return;
    setActiveBucketId(focusBucketId);
    // Keep the #item anchor, drop ?bucket so a reload doesn't jump back
    window.history.replaceState(null, "", `/${window.location.hash}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A guide hint asking to add: today has nowhere to add to, so it goes to a bucket that takes items
  const addItemRequest = useUIStore((s) => s.addItemRequest);
  const handledAddRequest = useRef(addItemRequest);
  useEffect(() => {
    if (addItemRequest === handledAddRequest.current) return;
    handledAddRequest.current = addItemRequest;
    const { todayOpen: onToday, activeBucketId: current, addItemForm } = useUIStore.getState();
    const shown = buckets.find((b) => b.id === current) ?? buckets[0];
    const target = shown && writable(shown) ? shown : onToday ? buckets.find(writable) : undefined;
    if (!target) return;
    if (onToday) setActiveBucketId(target.id);
    if (addItemForm) expandPending.current = true;
    else focusPending.current = true;
  }, [addItemRequest, buckets, setActiveBucketId]);

  useEffect(() => {
    if (!focusPending.current || !quickAddRef.current) return;
    focusPending.current = false;
    quickAddRef.current.focus();
  });

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

  // A switch first fades the old view out, and until the new one mounts, expand would open the old
  // view's form (or none, on today); an expand asked for meanwhile waits for the new view
  const placeKey = todayOpen ? "today" : activeBucket?.id;
  const [shownKey, setShownKey] = useState<typeof placeKey | null>(null);
  const switching = shownKey !== placeKey;
  useEffect(() => {
    if (switching || !expandPending.current || !viewRef.current) return;
    viewRef.current.startAdding();
    expandPending.current = false;
  });

  if (!activeBucket) return null;

  const canAddItem = !todayOpen && writable(activeBucket);

  function expand() {
    if (switching) expandPending.current = true;
    else viewRef.current?.startAdding();
  }

  return (
    <div className="flex flex-1 flex-col">
      <BucketTabs buckets={buckets} activeId={activeId} todayOpen={todayOpen} />
      <Banners />
      <div
        className="max-md:scrollbar-hide flex-1 overflow-y-auto pb-[420px]"
        onClick={(e) => {
          if (hasBottomBar && canAddItem && e.target === e.currentTarget) {
            quickAddRef.current?.focus();
          }
        }}
      >
        {hydrated && (
          <AnimatePresence mode="wait">
            <motion.div
              key={placeKey}
              variants={VIEW_FADE}
              initial="hidden"
              animate="visible"
              exit="gone"
              transition={{ duration: 0.15 }}
              // the view starts coming in as it mounts, with its add form; the leaving view's
              // animation fires this too, with "gone"
              onAnimationStart={(started) => {
                if (started === "visible") setShownKey(placeKey);
              }}
              className="max-w-column mx-auto w-full"
            >
              {todayOpen ? (
                <TodayView buckets={buckets} />
              ) : (
                <BucketContent
                  bucket={activeBucket}
                  accentColor={accentColor}
                  viewRef={viewRef}
                  addPanel={
                    panelSlot
                      ? { slot: panelSlot, onCollapsed: () => quickAddRef.current?.focus() }
                      : undefined
                  }
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      <BucketsFooter
        bucket={todayOpen ? null : activeBucket}
        color={accentColor}
        canAdd={canAddItem}
        inputRef={quickAddRef}
        panelSlotRef={setPanelSlot}
        onAdded={() => void viewRef.current?.refetch()}
        onExpand={expand}
      />
    </div>
  );
}

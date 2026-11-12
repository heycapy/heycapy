"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotionConfig } from "framer-motion";
import { BucketContent, type BucketView } from "./BucketContent";
import { BucketTabs } from "./BucketTabs";
import { BucketsFooter } from "./BucketsFooter";
import { BucketTargetPicker } from "./BucketTargetPicker";
import { TodayView } from "@/components/today/TodayView";
import { Banners } from "@/components/layout/Banners";
import { VIEW_FADE } from "./constants";
import { bucketColor } from "./bucket-color";
import { useUIStore } from "@/store/ui";
import { useLayoutStore } from "@/store/layout";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { itemLink } from "@/lib/items/item-link";
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
  const openItem = useUIStore((s) => s.openItem);
  const newBucketId = useUIStore((s) => s.newBucketId);
  const clearNewBucket = useUIStore((s) => s.clearNewBucket);
  const focusMode = useUIStore((s) => s.focusMode);
  const todayOpen = useUIStore((s) => s.todayOpen && !s.focusMode);
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
  const [todayAddId, setTodayAddId] = useState<number | null>(null);
  const tickRefresh = useUIStore((s) => s.tickRefresh);
  const [panelSlot, setPanelSlot] = useState<HTMLDivElement | null>(null);
  const hasBottomBar = useMediaQuery(BOTTOM_BAR_MEDIA_QUERY);

  useEffect(() => {
    setBottomBarShown(true);
    return () => setBottomBarShown(false);
  }, [setBottomBarShown]);

  useEffect(() => {
    const linked = itemLink(`/${window.location.search}${window.location.hash}`);
    if (linked) openItem(focusBucketId, linked.itemId);
    else if (focusBucketId !== null) setActiveBucketId(focusBucketId);
    if (linked || focusBucketId !== null) window.history.replaceState(null, "", "/");
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
  const accentColor = bucketColor(activeBucket?.colorIndex ?? 0);

  // A switch first fades the old view out, and until the new one mounts, expand would open the old
  // view's form (or none, on today); an expand asked for meanwhile waits for the new view
  const placeKey = todayOpen ? "today" : activeBucket?.id;
  const [shownKey, setShownKey] = useState<typeof placeKey | null>(null);
  const still = useReducedMotionConfig();
  const switching = !still && shownKey !== placeKey;
  useEffect(() => {
    if (switching || !expandPending.current || !viewRef.current) return;
    viewRef.current.startAdding();
    expandPending.current = false;
  });

  if (!activeBucket) return null;

  const writableBuckets = buckets.filter(writable);
  const todayTarget =
    writableBuckets.find((b) => b.id === todayAddId) ??
    (writable(activeBucket) ? activeBucket : writableBuckets[0]);
  const footerBucket = todayOpen ? (todayTarget ?? null) : activeBucket;
  const canAddItem = footerBucket !== null && writable(footerBucket);
  const itemPanel = panelSlot
    ? { slot: panelSlot, onCollapsed: () => quickAddRef.current?.focus() }
    : undefined;

  const view = todayOpen ? (
    <TodayView buckets={buckets} panel={itemPanel} />
  ) : (
    <BucketContent
      bucket={activeBucket}
      accentColor={accentColor}
      viewRef={viewRef}
      panel={itemPanel}
    />
  );

  function expand() {
    if (todayOpen && todayTarget) {
      expandPending.current = true;
      setActiveBucketId(todayTarget.id);
      return;
    }
    if (switching) expandPending.current = true;
    else viewRef.current?.startAdding();
  }

  return (
    <div className="flex flex-1 flex-col">
      {focusMode ? (
        <div className="max-w-column mx-auto w-full px-2 pt-3 pb-2">
          <BucketTargetPicker
            variant="heading"
            bucket={activeBucket}
            buckets={buckets}
            onPick={setActiveBucketId}
          />
        </div>
      ) : (
        <>
          <BucketTabs buckets={buckets} activeId={activeId} todayOpen={todayOpen} />
          <Banners />
        </>
      )}
      <div
        className="max-md:scrollbar-hide flex-1 overflow-y-auto pb-[calc(0.5rem+var(--item-panel-cover,0px))]"
        onClick={(e) => {
          if (hasBottomBar && canAddItem && e.target === e.currentTarget) {
            quickAddRef.current?.focus();
          }
        }}
      >
        {hydrated &&
          (still ? (
            <div key={placeKey} className="max-w-column mx-auto w-full">
              {view}
            </div>
          ) : (
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
                {view}
              </motion.div>
            </AnimatePresence>
          ))}
      </div>

      <BucketsFooter
        bucket={footerBucket}
        targets={
          todayOpen
            ? {
                buckets: writableBuckets,
                onPick: (id) => {
                  setTodayAddId(id);
                  requestAnimationFrame(() => quickAddRef.current?.focus());
                },
              }
            : undefined
        }
        color={accentColor}
        canAdd={canAddItem}
        inputRef={quickAddRef}
        panelSlotRef={setPanelSlot}
        onAdded={() => (todayOpen ? tickRefresh() : void viewRef.current?.refetch())}
        onExpand={expand}
      />
    </div>
  );
}

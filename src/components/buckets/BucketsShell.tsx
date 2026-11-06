"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BracketButton } from "@/components/ui/BracketButton";
import { BucketContent } from "./BucketContent";
import { BucketTabs } from "./BucketTabs";
import { Sprite } from "@/components/capy/Sprite";
import { TodayView } from "@/components/today/TodayView";
import { BUCKET_PALETTE, VIEW_FADE } from "./constants";
import { useUIStore } from "@/store/ui";
import { useLayoutStore } from "@/store/layout";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { parseItemsRules } from "@/lib/rules";
import { BOTTOM_BAR_MEDIA_QUERY } from "@/constants";
import type { ViewerBucket } from "@/lib/buckets/access";

type BucketsShellProps = {
  buckets: ViewerBucket[];
  focusBucketId?: number | null;
};

export function BucketsShell({ buckets: rawBuckets, focusBucketId = null }: BucketsShellProps) {
  const buckets = rawBuckets.filter((b, i, arr) => arr.findIndex((x) => x.id === b.id) === i);
  const setChatState = useLayoutStore((s) => s.setChatState);
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
  const addItemRef = useRef<(() => void) | null>(null);
  const addPending = useRef(false);
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

  const addItemRequest = useUIStore((s) => s.addItemRequest);
  const handledAddRequest = useRef(addItemRequest);
  useEffect(() => {
    if (addItemRequest === handledAddRequest.current) return;
    handledAddRequest.current = addItemRequest;
    addPending.current = true;
  }, [addItemRequest]);

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

  // A switch first fades the old view out, and until the new one mounts, add would open the old
  // view's form; an add asked for meanwhile waits for the new view
  const placeKey = todayOpen ? "today" : activeBucket?.id;
  const [shownKey, setShownKey] = useState<typeof placeKey | null>(null);
  const switching = shownKey !== placeKey;
  useEffect(() => {
    if (switching || !addPending.current) return;
    addPending.current = false;
    addItemRef.current?.();
  });

  if (!activeBucket) return null;

  const canAddItem = todayOpen
    ? buckets.some((b) => parseItemsRules(b.itemsRules).readonly !== true)
    : parseItemsRules(activeBucket.itemsRules).readonly !== true;

  function addItem() {
    if (switching) addPending.current = true;
    else addItemRef.current?.();
  }

  return (
    <div className="flex flex-1 flex-col">
      <BucketTabs buckets={buckets} activeId={activeId} todayOpen={todayOpen} />
      <div
        className="max-md:scrollbar-hide flex-1 overflow-y-auto pb-[420px]"
        onClick={(e) => {
          if (hasBottomBar && canAddItem && e.target === e.currentTarget) addItem();
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
              className="mx-auto w-full max-w-6xl"
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

      <div className="border-border bg-background sticky bottom-0 grid grid-cols-[1fr_auto_1fr] items-center border-t-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="col-start-2">
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
        <button
          onClick={() => setChatState("open")}
          aria-label="chat with capy"
          className="mr-3 flex min-h-14 items-center justify-self-end transition-transform active:scale-95 md:hidden"
        >
          <Sprite id="capy-idle-blink" size={48} />
        </button>
      </div>
    </div>
  );
}

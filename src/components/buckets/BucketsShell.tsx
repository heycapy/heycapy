"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
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
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
import { itemLink } from "@/lib/items/item-link";
import { parseItemsRules } from "@/lib/rules";
import type { ViewerBucket } from "@/lib/buckets/access";
import type { CrossBucketItems } from "@/lib/items/today";

const writable = (bucket: ViewerBucket) => parseItemsRules(bucket.itemsRules).readonly !== true;

type BucketsShellProps = {
  buckets: ViewerBucket[];
  todaySeed: CrossBucketItems;
  focusBucketId?: number | null;
};

export function BucketsShell({
  buckets: rawBuckets,
  todaySeed,
  focusBucketId = null,
}: BucketsShellProps) {
  const buckets = rawBuckets.filter((b, i, arr) => arr.findIndex((x) => x.id === b.id) === i);
  const setBottomBarShown = useLayoutStore((s) => s.setBottomBarShown);
  const activeBucketId = useUIStore((s) => s.activeBucketId);
  const setActiveBucketId = useUIStore((s) => s.setActiveBucketId);
  const openToday = useUIStore((s) => s.openToday);
  const openItem = useUIStore((s) => s.openItem);
  const newBucketId = useUIStore((s) => s.newBucketId);
  const clearNewBucket = useUIStore((s) => s.clearNewBucket);
  const focusMode = useUIStore((s) => s.focusMode);
  const offline = useUIStore((s) => s.offline);
  const todayOpen = useUIStore((s) => s.todayOpen);
  // The open view is remembered per session, wait for it rather than flash the default
  const hydrated = useSyncExternalStore(
    (onChange) => useUIStore.persist.onFinishHydration(onChange),
    () => useUIStore.persist.hasHydrated(),
    () => false
  );
  // Today's list from the page load, used once and only if Today is what opens: a later visit to
  // Today fetches it again
  const [seed, setSeed] = useState<CrossBucketItems | null>(todaySeed);
  const dropSeed = useCallback(() => setSeed(null), []);
  if (seed && hydrated && !todayOpen) setSeed(null);
  const prevBucketsRef = useRef<ViewerBucket[]>(buckets);
  const viewRef = useRef<BucketView | null>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const editing = useLayoutStore((s) => s.openEditors > 0);
  const keyboardInset = useKeyboardInset();
  const expandPending = useRef(false);
  const [todayAddId, setTodayAddId] = useState<number | null>(null);

  // With the keyboard up an open row must stay in view: the footer is gone, so the list itself
  // makes room for the keyboard and follows it
  useEffect(() => {
    if (!editing) return;
    document.querySelector("[data-inline-edit]")?.scrollIntoView({ block: "nearest" });
  }, [editing, keyboardInset]);

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
    if (useUIStore.getState().offline) return;
    const { todayOpen: onToday, activeBucketId: current } = useUIStore.getState();
    const shown = buckets.find((b) => b.id === current) ?? buckets[0];
    const target = shown && writable(shown) ? shown : onToday ? buckets.find(writable) : undefined;
    if (!target) return;
    if (onToday) setActiveBucketId(target.id);
    expandPending.current = true;
  }, [addItemRequest, buckets, setActiveBucketId]);

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
  const canAddItem = !offline && footerBucket !== null && writable(footerBucket);

  const view = todayOpen ? (
    <TodayView seed={seed} onSeedUsed={dropSeed} />
  ) : (
    <BucketContent
      bucket={activeBucket}
      accentColor={accentColor}
      viewRef={viewRef}
      onAddClosed={() => requestAnimationFrame(() => addButtonRef.current?.focus())}
    />
  );

  function startAdding() {
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
            bucket={todayOpen ? null : activeBucket}
            buckets={buckets}
            onPick={setActiveBucketId}
            today={openToday}
          />
        </div>
      ) : (
        <>
          <BucketTabs buckets={buckets} activeId={activeId} todayOpen={todayOpen} />
          <Banners />
        </>
      )}
      <div
        style={{ "--keyboard-inset": `${editing ? keyboardInset : 0}px` } as CSSProperties}
        className="max-md:scrollbar-hide flex-1 overflow-y-auto pb-[calc(0.5rem+var(--keyboard-inset))]"
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
                },
              }
            : undefined
        }
        color={accentColor}
        canAdd={canAddItem}
        hidden={editing}
        buttonRef={addButtonRef}
        onAdd={startAdding}
      />
    </div>
  );
}

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Reorder, motion } from "framer-motion";
import { toast } from "sonner";
import { TextButton } from "@/components/ui/TextButton";
import { Icon } from "@/components/ui/Icon";
import { useLayoutStore } from "@/store/layout";
import { useUIStore } from "@/store/ui";
import { cn } from "@/lib/utils";
import { bucketColor } from "./bucket-color";
import { useLateBuckets } from "./useLateBuckets";
import { ReorderTab } from "./ReorderTab";
import { reorderBucketsAction } from "@/app/(app)/bucket-actions";
import type { ViewerBucket } from "@/lib/buckets/access";
import { IconButton } from "@/components/ui/IconButton";

type BucketTabsProps = {
  buckets: ViewerBucket[];
  activeId: number;
  todayOpen: boolean;
};

function PlaceTab({
  active,
  color,
  lateHintId,
  onSelect,
  onSettings,
  children,
}: {
  active: boolean;
  color: string;
  // set when the place has late items: the id of the text that says so
  lateHintId?: string;
  onSelect: () => void;
  onSettings?: () => void;
  children: ReactNode;
}) {
  return (
    <span className="flex shrink-0 items-center">
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? "page" : undefined}
        aria-describedby={lateHintId}
        data-late={lateHintId ? true : undefined}
        className={cn(
          "font-display flex h-11 items-center px-3 text-xs whitespace-nowrap transition-colors",
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <span className="relative pt-0.5 pb-1.5">
          <span className="block max-w-32 truncate">{children}</span>
          {active && (
            <span
              aria-hidden
              className="absolute bottom-0 left-0 h-0.5 w-2.5"
              style={{ backgroundColor: color }}
            />
          )}
          {lateHintId && (
            <span aria-hidden className="bg-destructive absolute -top-0.5 -right-2 size-1" />
          )}
        </span>
      </button>
      {onSettings && (
        <IconButton
          icon="sliders"
          onClick={onSettings}
          aria-label="bucket settings"
          className="-ml-1 flex h-11 items-center pr-3"
        />
      )}
    </span>
  );
}

// Search stays put at the start while the places scroll beside it
export function BucketTabs({ buckets, activeId, todayOpen }: BucketTabsProps) {
  const late = useLateBuckets();
  const lateHint = useId();
  const stripRef = useRef<HTMLDivElement>(null);
  const setSearchOpen = useLayoutStore((s) => s.setSearchOpen);
  const openToday = useUIStore((s) => s.openToday);
  const setActiveBucketId = useUIStore((s) => s.setActiveBucketId);
  const requestBucketSettings = useUIStore((s) => s.requestBucketSettings);
  const openCreateBucket = useUIStore((s) => s.openCreateBucket);
  const activeKey = todayOpen ? "today" : activeId;
  const serverOrder = buckets.map((b) => b.id);
  const [order, setOrder] = useState(serverOrder);
  const [orderFrom, setOrderFrom] = useState(serverOrder.join());
  if (orderFrom !== serverOrder.join()) {
    setOrderFrom(serverOrder.join());
    setOrder(serverOrder);
  }
  const byId = new Map(buckets.map((b) => [b.id, b]));
  const dragging = useRef(false);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const hold = (e: TouchEvent) => dragging.current && e.preventDefault();
    strip.addEventListener("touchmove", hold, { passive: false });
    return () => strip.removeEventListener("touchmove", hold);
  }, []);

  async function saveOrder() {
    dragging.current = false;
    if (order.join() === serverOrder.join()) return;
    const result = await reorderBucketsAction(order);
    if (!result.ok) {
      setOrder(serverOrder);
      toast.error(result.error);
    }
  }

  useEffect(() => {
    stripRef.current
      ?.querySelector('[aria-current="page"]')
      ?.parentElement?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeKey]);

  return (
    <nav
      aria-label="buckets"
      className="bg-background max-w-column sticky top-0 z-10 mx-auto w-full sm:px-4"
    >
      <div className="border-border border-b-frame flex">
        <TextButton
          variant="ghost"
          onClick={() => setSearchOpen(true)}
          aria-label="search"
          className="shrink-0 py-0 pr-3 pl-4 sm:pl-3"
        >
          <Icon name="search" />
        </TextButton>
        <span aria-hidden className="bg-border my-3.5 w-px shrink-0" />
        <motion.div
          ref={stripRef}
          layoutScroll
          className="scrollbar-hide flex min-w-0 flex-1 overflow-x-auto"
        >
          <PlaceTab
            active={todayOpen}
            color="var(--foreground)"
            lateHintId={late.size > 0 ? lateHint : undefined}
            onSelect={openToday}
          >
            <span className="flex items-center gap-1.5">
              <Icon name="clock" />
              today
            </span>
          </PlaceTab>
          <Reorder.Group
            as="div"
            axis="x"
            values={order}
            onReorder={setOrder}
            className="flex shrink-0"
          >
            {order.map((id) => {
              const bucket = byId.get(id);
              if (!bucket) return null;
              const active = !todayOpen && bucket.id === activeId;
              return (
                <ReorderTab
                  key={bucket.id}
                  id={bucket.id}
                  color={bucketColor(bucket.colorIndex)}
                  onDragStart={() => (dragging.current = true)}
                  onDragEnd={() => void saveOrder()}
                >
                  <PlaceTab
                    active={active}
                    color={bucketColor(bucket.colorIndex)}
                    lateHintId={late.has(bucket.id) ? lateHint : undefined}
                    onSelect={() => setActiveBucketId(bucket.id)}
                    onSettings={active ? () => requestBucketSettings(bucket.id) : undefined}
                  >
                    {bucket.icon ? `${bucket.icon} ${bucket.name}` : bucket.name}
                  </PlaceTab>
                </ReorderTab>
              );
            })}
          </Reorder.Group>
          <TextButton
            variant="ghost"
            onClick={openCreateBucket}
            aria-label="new bucket"
            className="shrink-0 py-0 pr-4 pl-3 whitespace-nowrap"
          >
            + new
          </TextButton>
        </motion.div>
      </div>
      <span id={lateHint} hidden>
        has late items
      </span>
    </nav>
  );
}

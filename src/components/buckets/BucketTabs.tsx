import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Reorder, motion } from "framer-motion";
import { notify } from "@/components/ui/notify";
import { TextButton } from "@/components/ui/TextButton";
import { Icon } from "@/components/ui/Icon";
import { useLayoutStore } from "@/store/layout";
import { useUIStore } from "@/store/ui";
import { cn } from "@/lib/utils";
import { useLookParts } from "@/components/looks/LookProvider";
import { bucketColor } from "./bucket-color";
import { useLateBuckets } from "./useLateBuckets";
import { ReorderTab } from "./ReorderTab";
import { reorderBucketsAction } from "@/app/(app)/bucket-actions";
import type { ViewerBucket } from "@/lib/buckets/access";
import { KeyHint } from "@/components/ui/KeyHint";
import { BUCKET_ACTIONS } from "@/lib/keybinds/constants";
import type { KeybindActionId } from "@/lib/keybinds/constants";
import { IconButton } from "@/components/ui/IconButton";
import { useWheelScrollX } from "@/hooks/useWheelScrollX";

type BucketTabsProps = {
  buckets: ViewerBucket[];
  activeId: number;
  todayOpen: boolean;
};

export function PlaceTab({
  active,
  color,
  lateHintId,
  onSelect,
  onSettings,
  hint,
  children,
}: {
  active: boolean;
  color: string;
  // set when the place has late items: the id of the text that says so
  lateHintId?: string;
  onSelect: () => void;
  onSettings?: () => void;
  hint?: KeybindActionId;
  children: ReactNode;
}) {
  const pill = useLookParts().bucketTab === "pill";
  return (
    <span
      className={cn(
        "rounded-control flex shrink-0 items-center transition-colors",
        pill && "my-1.5",
        pill && active && "bg-(--selected-bg)",
        pill && !active && "hover:bg-muted/60"
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? "page" : undefined}
        aria-describedby={lateHintId}
        data-late={lateHintId ? true : undefined}
        className={cn(
          "font-display flex items-center px-3 text-xs whitespace-nowrap transition-colors",
          pill ? "h-(--control-h) gap-2" : "h-11",
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        {pill && active && (
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
        )}
        <span className={cn("relative", !pill && "pt-0.5 pb-1.5")}>
          <span className="block max-w-32 truncate">{children}</span>
          {active && !pill && (
            <span
              aria-hidden
              className="absolute bottom-0 left-0 h-0.5 w-2.5"
              style={{ backgroundColor: color }}
            />
          )}
          {lateHintId && (
            <span
              aria-hidden
              className="bg-destructive absolute -top-0.5 -right-2 size-(--late-dot) rounded-(--dot-radius)"
            />
          )}
        </span>
        {hint && <KeyHint action={hint} />}
      </button>
      {onSettings && (
        <>
          <IconButton
            icon="sliders"
            onClick={onSettings}
            aria-label="bucket settings"
            className={cn("-ml-1 flex items-center pr-3", pill ? "h-(--control-h)" : "h-11")}
          />
          <KeyHint action="bucket-settings" className="mr-3 -ml-2" />
        </>
      )}
    </span>
  );
}

const BUCKET_NUMBER_ACTIONS = BUCKET_ACTIONS.map((a) => a.id);

// Search stays put at the start while the places scroll beside it
export function BucketTabs({ buckets, activeId, todayOpen }: BucketTabsProps) {
  const late = useLateBuckets();
  const lateHint = useId();
  const stripRef = useRef<HTMLDivElement>(null);
  useWheelScrollX(stripRef);
  const setSearchOpen = useLayoutStore((s) => s.setSearchOpen);
  const openToday = useUIStore((s) => s.openToday);
  const setActiveBucketId = useUIStore((s) => s.setActiveBucketId);
  const requestBucketSettings = useUIStore((s) => s.requestBucketSettings);
  const setBucketOrder = useLayoutStore((s) => s.setBucketOrder);
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
    setBucketOrder(order);
  }, [order, setBucketOrder]);

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
      notify.error(result.error);
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
          <KeyHint action="search" className="ml-1" />
        </TextButton>
        <span aria-hidden className="bg-border h-4 w-px shrink-0 self-center" />
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
            hint="today"
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
            {order.map((id, index) => {
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
                    hint={BUCKET_NUMBER_ACTIONS[index]}
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
            className="shrink-0 self-center py-0 pr-4 pl-3 whitespace-nowrap"
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

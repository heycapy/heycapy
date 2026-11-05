import { Clock } from "pixelarticons/react/Clock.js";
import { Search } from "pixelarticons/react/Search.js";
import { SlidersHorizontal } from "pixelarticons/react/SlidersHorizontal.js";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { BracketButton } from "@/components/ui/BracketButton";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { useLayoutStore } from "@/store/layout";
import { useUIStore } from "@/store/ui";
import { cn } from "@/lib/utils";
import { BUCKET_PALETTE } from "./constants";
import { useLateBuckets } from "./useLateBuckets";
import type { ViewerBucket } from "@/lib/buckets/access";

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
          "font-pixel flex h-11 items-center px-3 text-xs whitespace-nowrap transition-colors",
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <span
          className="relative border-b-2 py-0.5"
          style={{ borderBottomColor: active ? color : "transparent" }}
        >
          <span className="block max-w-32 truncate">{children}</span>
          {lateHintId && (
            <span aria-hidden className="bg-destructive absolute -top-0.5 -right-2 size-1" />
          )}
        </span>
      </button>
      {onSettings && (
        <button
          type="button"
          onClick={onSettings}
          aria-label="bucket settings"
          className="text-muted-foreground hover:text-foreground -ml-1 flex h-11 items-center pr-3 transition-colors"
        >
          <PixelIcon icon={SlidersHorizontal} />
        </button>
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

  useEffect(() => {
    stripRef.current
      ?.querySelector('[aria-current="page"]')
      ?.parentElement?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeKey]);

  return (
    <nav aria-label="buckets" className="border-border mx-auto flex w-full max-w-6xl border-b-2">
      <BracketButton
        onClick={() => setSearchOpen(true)}
        aria-label="search"
        className="shrink-0 py-0 pr-3 pl-4"
      >
        <PixelIcon icon={Search} />
      </BracketButton>
      <span aria-hidden className="bg-border my-3.5 w-px shrink-0" />
      <div ref={stripRef} className="scrollbar-hide flex min-w-0 flex-1 overflow-x-auto">
        <PlaceTab
          active={todayOpen}
          color="var(--foreground)"
          lateHintId={late.size > 0 ? lateHint : undefined}
          onSelect={openToday}
        >
          <span className="flex items-center gap-1.5">
            <PixelIcon icon={Clock} />
            today
          </span>
        </PlaceTab>
        {buckets.map((bucket, i) => {
          const active = !todayOpen && bucket.id === activeId;
          return (
            <PlaceTab
              key={bucket.id}
              active={active}
              color={BUCKET_PALETTE[i % BUCKET_PALETTE.length]}
              lateHintId={late.has(bucket.id) ? lateHint : undefined}
              onSelect={() => setActiveBucketId(bucket.id)}
              onSettings={active ? () => requestBucketSettings(bucket.id) : undefined}
            >
              {bucket.icon ? `${bucket.icon} ${bucket.name}` : bucket.name}
            </PlaceTab>
          );
        })}
        <BracketButton
          onClick={openCreateBucket}
          aria-label="new bucket"
          className="shrink-0 py-0 pr-4 pl-3 whitespace-nowrap"
        >
          + new
        </BracketButton>
      </div>
      <span id={lateHint} hidden>
        has late items
      </span>
    </nav>
  );
}

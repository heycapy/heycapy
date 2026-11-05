import { Archive } from "pixelarticons/react/Archive.js";
import { Clock } from "pixelarticons/react/Clock.js";
import { Plus } from "pixelarticons/react/Plus.js";
import { SlidersHorizontal } from "pixelarticons/react/SlidersHorizontal.js";
import { Trash } from "pixelarticons/react/Trash.js";
import { UserPlus } from "pixelarticons/react/UserPlus.js";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Modal, ModalTitle } from "@/components/ui/Modal";
import { PixelIcon, type PixelIconComponent } from "@/components/ui/PixelIcon";
import { BetaTag } from "@/components/ui/BetaTag";
import { getOpenItemsAction } from "@/app/(app)/actions";
import { useUIStore } from "@/store/ui";
import { cn } from "@/lib/utils";
import { BUCKET_PALETTE } from "./constants";
import { countPlaces, type PlaceCounts } from "./place-counts";
import type { buckets as bucketsTable } from "@/lib/db/schema";

type BucketRow = typeof bucketsTable.$inferSelect;

type PlacesDrawerProps = {
  open: boolean;
  buckets: BucketRow[];
  todayOpen: boolean;
  activeId: number;
  onClose: () => void;
};

const ROW = "flex h-11 shrink-0 items-center gap-2.5 pl-4";
const ROW_NAME = "flex h-full min-w-0 flex-1 items-center gap-2.5 text-left font-mono text-sm";

function PlaceRow({
  active,
  lead,
  name,
  count,
  end,
  onGo,
}: {
  active: boolean;
  lead: ReactNode;
  name: string;
  count?: ReactNode;
  end?: ReactNode;
  onGo: () => void;
}) {
  return (
    <div className={cn(ROW, active && "bg-background")}>
      <button
        type="button"
        onClick={onGo}
        aria-current={active ? "page" : undefined}
        className={ROW_NAME}
      >
        <span className="text-muted-foreground flex w-3 shrink-0 justify-center">{lead}</span>
        <span className="truncate">{name}</span>
      </button>
      {count !== undefined && (
        <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
          {count}
        </span>
      )}
      <span className="flex h-full w-10 shrink-0 items-center justify-center">{end}</span>
    </div>
  );
}

function ActionRow({
  icon,
  label,
  accent,
  tag,
  onClick,
}: {
  icon: PixelIconComponent;
  label: string;
  accent?: boolean;
  tag?: ReactNode;
  onClick: () => void;
}) {
  return (
    <div className={ROW}>
      <button
        type="button"
        onClick={onClick}
        className={cn(ROW_NAME, accent ? "text-(--p3)" : "text-foreground")}
      >
        <span className="text-muted-foreground flex w-3 shrink-0 justify-center">
          <PixelIcon icon={icon} />
        </span>
        <span className="truncate">
          {label}
          {tag}
        </span>
      </button>
      <span className="w-10 shrink-0" />
    </div>
  );
}

function bucketCount(counts: PlaceCounts | null, id: number): ReactNode {
  if (!counts) return null;
  const { open, late } = counts.buckets[id] ?? { open: 0, late: 0 };
  return (
    <>
      {late > 0 && <span className="text-destructive">{late} late · </span>}
      {open}
    </>
  );
}

// Fills from the bottom, so today and the first buckets sit nearest a thumb
export function PlacesDrawer({ open, buckets, todayOpen, activeId, onClose }: PlacesDrawerProps) {
  const [counts, setCounts] = useState<PlaceCounts | null>(null);
  // A long list opens at its bottom end, where today is
  const scrollToBottom = useCallback((list: HTMLElement | null) => {
    if (list) list.scrollTop = list.scrollHeight;
  }, []);
  const openToday = useUIStore((s) => s.openToday);
  const setActiveBucketId = useUIStore((s) => s.setActiveBucketId);
  const requestBucketSettings = useUIStore((s) => s.requestBucketSettings);
  const openCreateBucket = useUIStore((s) => s.openCreateBucket);
  const openSheet = useUIStore((s) => s.openSheet);

  useEffect(() => {
    if (!open) return;
    let current = true;
    void getOpenItemsAction().then((result) => {
      if (current && result.ok) setCounts(countPlaces(result.items));
    });
    return () => {
      current = false;
    };
  }, [open]);

  const afterCloseRef = useRef<(() => void) | null>(null);

  function go(action: () => void) {
    onClose();
    action();
  }

  // Another dialog waits until the drawer has gone: while it slides out it is still the top
  // layer, so Escape would reach it instead of the new one
  function openAfterClose(action: () => void) {
    afterCloseRef.current = action;
    onClose();
  }

  function runAfterClose() {
    const action = afterCloseRef.current;
    afterCloseRef.current = null;
    action?.();
  }

  const colored = buckets.map((bucket, i) => ({
    bucket,
    color: BUCKET_PALETTE[i % BUCKET_PALETTE.length],
  }));

  return (
    <Modal open={open} onClose={onClose} variant="leftSheet" onExitComplete={runAfterClose}>
      <div className="flex shrink-0 items-center px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-2">
        <ModalTitle className="text-muted-foreground">buckets</ModalTitle>
      </div>
      <nav
        ref={scrollToBottom}
        aria-label="buckets"
        className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        {/* mt-auto, not justify-end: an overflowing justify-end list can't scroll to its top */}
        <div className="mt-auto flex shrink-0 flex-col">
          <ActionRow
            icon={Trash}
            label="trash"
            onClick={() => openAfterClose(() => openSheet("trash"))}
          />
          <ActionRow
            icon={Archive}
            label="archive"
            onClick={() => openAfterClose(() => openSheet("archive"))}
          />
          <ActionRow
            icon={UserPlus}
            label="join a bucket"
            accent
            tag={<BetaTag feature="sharing" />}
            onClick={() => openAfterClose(() => openSheet("join"))}
          />
          <ActionRow
            icon={Plus}
            label="new bucket"
            accent
            onClick={() => openAfterClose(openCreateBucket)}
          />
          <div className="border-border mt-1 border-t pt-1">
            {[...colored].reverse().map(({ bucket, color }) => {
              const name = bucket.icon ? `${bucket.icon} ${bucket.name}` : bucket.name;
              return (
                <PlaceRow
                  key={bucket.id}
                  active={!todayOpen && bucket.id === activeId}
                  lead={<span className="h-3.5 w-0.5" style={{ backgroundColor: color }} />}
                  name={name}
                  count={bucketCount(counts, bucket.id)}
                  onGo={() => go(() => setActiveBucketId(bucket.id))}
                  end={
                    <button
                      type="button"
                      onClick={() => openAfterClose(() => requestBucketSettings(bucket.id))}
                      aria-label={`${name} settings`}
                      className="text-muted-foreground hover:text-foreground flex h-full w-full items-center justify-center transition-colors"
                    >
                      <PixelIcon icon={SlidersHorizontal} />
                    </button>
                  }
                />
              );
            })}
          </div>
          <PlaceRow
            active={todayOpen}
            lead={<PixelIcon icon={Clock} />}
            name="today"
            count={counts?.today}
            onGo={() => go(openToday)}
          />
        </div>
      </nav>
    </Modal>
  );
}

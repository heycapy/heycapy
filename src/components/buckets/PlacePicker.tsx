import type { ReactNode } from "react";
import { Drawer } from "vaul";
import { Check, Clock, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { BUCKET_PALETTE } from "./constants";
import { useUIStore } from "@/store/ui";
import type { buckets } from "@/lib/db/schema";

type BucketRow = typeof buckets.$inferSelect;

type PlacePickerProps = {
  open: boolean;
  buckets: BucketRow[];
  todayOpen: boolean;
  activeId: number;
  onSelectToday: () => void;
  onSelectBucket: (id: number) => void;
  onClose: () => void;
};

function PlaceRow({
  active,
  onClick,
  className,
  children,
}: {
  active: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "border-border flex w-full items-center gap-3 border-b px-4 py-3.5 text-left transition-colors",
        active ? "bg-card" : "hover:bg-muted",
        className
      )}
    >
      {children}
      {active && <Check size={12} className="text-foreground shrink-0" />}
    </button>
  );
}

export function PlacePicker({
  open,
  buckets,
  todayOpen,
  activeId,
  onSelectToday,
  onSelectBucket,
  onClose,
}: PlacePickerProps) {
  const openCreateBucket = useUIStore((s) => s.openCreateBucket);

  function pick(select: () => void) {
    onClose();
    select();
  }

  return (
    <Drawer.Root open={open} onOpenChange={(v) => !v && onClose()} shouldScaleBackground={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Drawer.Content className="bg-background border-border fixed inset-x-0 bottom-0 z-50 flex flex-col border-t-2 outline-none">
          <div className="mx-auto mt-2 mb-1 h-1 w-8 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-600" />
          <Drawer.Title className="font-pixel text-muted-foreground px-4 pt-1 pb-3 text-xs">
            go to
          </Drawer.Title>
          <div className="border-border max-h-[60vh] overflow-y-auto border-t pb-[env(safe-area-inset-bottom)]">
            <PlaceRow active={todayOpen} onClick={() => pick(onSelectToday)} className="border-b-2">
              <Clock size={12} className="text-foreground shrink-0" aria-hidden />
              <span className="font-pixel text-foreground flex-1 text-xs">today</span>
            </PlaceRow>
            {buckets.map((bucket, i) => (
              <PlaceRow
                key={bucket.id}
                active={!todayOpen && bucket.id === activeId}
                onClick={() => pick(() => onSelectBucket(bucket.id))}
              >
                <span
                  className="mt-0.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: BUCKET_PALETTE[i % BUCKET_PALETTE.length] }}
                />
                <span className="font-pixel text-foreground flex-1 truncate text-xs">
                  {bucket.icon ? `${bucket.icon} ${bucket.name}` : bucket.name}
                </span>
              </PlaceRow>
            ))}
            <button
              onClick={() => pick(openCreateBucket)}
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

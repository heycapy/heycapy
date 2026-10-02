import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls, type PanInfo } from "framer-motion";
import { BracketButton } from "@/components/ui/BracketButton";
import { ItemDialog } from "@/components/buckets/ItemDialog";
import { useItemEditor } from "@/components/buckets/useItemEditor";
import { parseFields } from "@/components/buckets/fields";
import { DEFAULT_BUCKET_STATUSES } from "@/components/buckets/constants";
import { CrossBucketList } from "@/components/today/CrossBucketList";
import { ITEM_STATUS, SHEET_CLOSE_DRAG_PX, SHEET_CLOSE_DRAG_VELOCITY } from "@/constants";
import { useSearchItems } from "@/components/today/useTodayItems";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useVisualViewport } from "@/hooks/useVisualViewport";
import { useLayoutStore } from "@/store/layout";

const noSubscribe = () => () => {};

export function SearchDrawer() {
  const open = useLayoutStore((s) => s.searchOpen);
  const setSearchOpen = useLayoutStore((s) => s.setSearchOpen);
  const isClient = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false
  );
  if (!isClient) return null;

  return createPortal(
    <AnimatePresence>
      {open && <SearchBody onClose={() => setSearchOpen(false)} />}
    </AnimatePresence>,
    document.body
  );
}

function SearchBody({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const { data, refetch } = useSearchItems(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const visible = useVisualViewport();
  const term = query.trim();
  const statuses = DEFAULT_BUCKET_STATUSES;
  const editor = useItemEditor({
    bucketId: 0,
    defaultStatus: statuses.find((s) => s.isDefault)?.name ?? ITEM_STATUS.active,
    defaultDeadline: () => "",
    onSaved: refetch,
  });
  const editingItem = data?.items.find((i) => i.id === editor.editingItemId);
  const editingBucket = data?.buckets.find((b) => b.id === editingItem?.bucketId);
  const fields = parseFields(editingBucket?.fieldSchema);
  const dragControls = useDragControls();
  useScrollLock(true);

  useLayoutEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <>
      <motion.div
        aria-hidden
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 bg-black/30"
      />
      <div
        style={visible ? { top: visible.top, height: visible.height } : undefined}
        className="pointer-events-none fixed inset-x-0 top-0 bottom-0 z-50 flex flex-col justify-end"
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="search"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          drag="y"
          dragListener={false}
          dragControls={dragControls}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 1 }}
          onDragEnd={(_, info: PanInfo) => {
            if (info.offset.y > SHEET_CLOSE_DRAG_PX || info.velocity.y > SHEET_CLOSE_DRAG_VELOCITY)
              onClose();
          }}
          className="border-border bg-background pointer-events-auto mx-auto flex h-[85%] w-full flex-col border-t-2 md:h-[70%] md:max-w-2xl md:border-x-2"
        >
          <div
            onPointerDown={(e) => {
              if (!(e.target as HTMLElement).closest("button")) dragControls.start(e);
            }}
            className="bg-card shrink-0 touch-none select-none"
          >
            <div className="flex justify-center pt-2 md:hidden">
              <div className="bg-border h-1 w-10 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-4">
              <span className="font-pixel py-3 text-xs">search every bucket</span>
              <BracketButton onClick={onClose} className="px-1 py-3 text-sm">
                x
              </BracketButton>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="flex min-h-full flex-col justify-end py-3">
              <CrossBucketList
                data={data}
                sections={
                  term && data && data.items.length > 0
                    ? [{ label: `${data.items.length} found`, items: data.items }]
                    : []
                }
                emptyText={term ? "no items match" : "type to search every bucket"}
                editingItemId={editor.editingItemId}
                onEdit={editor.startEditing}
                onChanged={refetch}
                boxed
              />
            </div>
          </div>

          <div className="border-border shrink-0 border-t-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:pb-0">
            <div className="flex h-14 items-center gap-3 px-4 md:h-11">
              <input
                ref={inputRef}
                type="text"
                inputMode="search"
                enterKeyHint="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") onClose();
                }}
                placeholder="search all items…"
                aria-label="search all items"
                maxLength={200}
                className="placeholder:text-muted-foreground/50 h-full min-w-0 flex-1 bg-transparent font-mono text-base outline-none md:text-sm"
              />
              {query && (
                <BracketButton
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  className="h-full text-sm"
                >
                  clear
                </BracketButton>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      <ItemDialog
        {...editor.dialogProps}
        bucketReminders={editingBucket?.defaultReminders}
        statuses={statuses}
        fields={fields.length > 0 ? fields : undefined}
      />
    </>
  );
}

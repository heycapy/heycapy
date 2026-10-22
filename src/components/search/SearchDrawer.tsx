import { useLayoutEffect, useRef, useState } from "react";
import { motion, useDragControls, type PanInfo } from "framer-motion";
import { BracketButton } from "@/components/ui/BracketButton";
import { Modal, ModalTitle } from "@/components/ui/Modal";
import { ItemDialog } from "@/components/buckets/ItemDialog";
import { useItemEditor } from "@/components/buckets/useItemEditor";
import { parseFields } from "@/components/buckets/fields";
import { DEFAULT_BUCKET_STATUSES } from "@/components/buckets/constants";
import { CrossBucketList } from "@/components/today/CrossBucketList";
import { ITEM_STATUS, SHEET_CLOSE_DRAG_PX, SHEET_CLOSE_DRAG_VELOCITY } from "@/constants";
import { useSearchItems } from "@/components/today/useTodayItems";
import { useVisualViewport } from "@/hooks/useVisualViewport";
import { useLayoutStore } from "@/store/layout";

export function SearchDrawer() {
  const open = useLayoutStore((s) => s.searchOpen);
  const setSearchOpen = useLayoutStore((s) => s.setSearchOpen);
  const close = () => setSearchOpen(false);

  return (
    <Modal open={open} onClose={close} variant="drawer" label="search">
      <SearchBody onClose={close} />
    </Modal>
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

  useLayoutEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <>
      <div
        style={visible ? { top: visible.top, height: visible.height } : undefined}
        className="pointer-events-none absolute inset-x-0 top-0 bottom-0 flex flex-col justify-end"
      >
        <motion.div
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
              <ModalTitle className="py-3">search every bucket</ModalTitle>
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

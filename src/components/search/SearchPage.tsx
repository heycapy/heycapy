import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BracketButton } from "@/components/ui/BracketButton";
import { ItemDialog } from "@/components/buckets/ItemDialog";
import { useItemEditor } from "@/components/buckets/useItemEditor";
import { parseFields } from "@/components/buckets/fields";
import { DEFAULT_BUCKET_STATUSES } from "@/components/buckets/constants";
import { CrossBucketList } from "@/components/today/CrossBucketList";
import { ITEM_STATUS } from "@/constants";
import { useSearchItems } from "@/components/today/useTodayItems";
import { useScrollLock } from "@/hooks/useScrollLock";

type SearchPageProps = {
  open: boolean;
  onClose: () => void;
};

export function SearchPage({ open, onClose }: SearchPageProps) {
  if (!open) return null;
  return createPortal(<SearchBody onClose={onClose} />, document.body);
}

function SearchBody({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const { data, refetch } = useSearchItems(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const term = query.trim();
  const statuses = DEFAULT_BUCKET_STATUSES;
  const editor = useItemEditor({
    bucketId: 0,
    defaultStatus: statuses.find((s) => s.isDefault)?.name ?? ITEM_STATUS.active,
    defaultDeadline: () => "",
    onSaved: refetch,
  });
  const editingItem = data?.items.find((i) => i.id === editor.editingItemId);
  const fields = parseFields(
    data?.buckets.find((b) => b.id === editingItem?.bucketId)?.fieldSchema
  );
  useScrollLock(true);

  // In the commit of the tap that opened it, so iOS raises the keyboard too
  useLayoutEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="search"
      className="bg-background fixed inset-0 z-[52] flex flex-col pt-[env(safe-area-inset-top)]"
    >
      <div className="border-border flex shrink-0 items-center gap-3 border-b-2 px-4 py-2">
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
          // 16px on phones: iOS zooms the page into any smaller input
          className="placeholder:text-muted-foreground/50 min-w-0 flex-1 bg-transparent py-2 font-mono text-base outline-none sm:text-sm"
        />
        <BracketButton onClick={onClose} className="py-2 text-base">
          close
        </BracketButton>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pt-3 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto w-full max-w-2xl">
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
          />
        </div>
      </div>

      <ItemDialog
        {...editor.dialogProps}
        statuses={statuses}
        fields={fields.length > 0 ? fields : undefined}
      />
    </div>
  );
}

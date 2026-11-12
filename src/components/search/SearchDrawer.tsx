import { useLayoutEffect, useRef, useState } from "react";
import { CloseButton } from "@/components/ui/CloseButton";
import { Icon } from "@/components/ui/Icon";
import { ModalTitle } from "@/components/ui/Modal";
import { BottomDrawer } from "@/components/ui/Drawer";
import { ItemDialog } from "@/components/buckets/ItemDialog";
import { useItemEditor } from "@/components/buckets/useItemEditor";
import { useBucketMembers } from "@/components/buckets/useBucketMembers";
import { parseFields } from "@/components/buckets/fields";
import { DEFAULT_BUCKET_STATUSES } from "@/components/buckets/constants";
import { CrossBucketList } from "@/components/today/CrossBucketList";
import { ITEM_STATUS } from "@/constants";
import { useSearchItems } from "@/components/today/useTodayItems";
import { useLayoutStore } from "@/store/layout";
import { IconButton } from "@/components/ui/IconButton";

export function SearchDrawer() {
  const open = useLayoutStore((s) => s.searchOpen);
  const setSearchOpen = useLayoutStore((s) => s.setSearchOpen);
  const close = () => setSearchOpen(false);

  return (
    <BottomDrawer
      open={open}
      onClose={close}
      label="search"
      className="md:max-w-column md:border-x-frame h-[85%] md:h-[70%]"
      header={
        <div className="flex items-center justify-between px-4">
          <ModalTitle className="py-3">search every bucket</ModalTitle>
          <span className="sr-only">
            <CloseButton onClick={close} aria-label="close search" />
          </span>
        </div>
      }
    >
      <SearchBody />
    </BottomDrawer>
  );
}

function SearchBody() {
  const [query, setQuery] = useState("");
  const { data, refetch } = useSearchItems(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const [panelSlot, setPanelSlot] = useState<HTMLDivElement | null>(null);
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
  const members = useBucketMembers(editingItem?.bucketId ?? null, editor.dialogProps.open);

  useLayoutEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <>
      <div className="max-md:scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-contain">
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

      <div className="border-border focus-within:border-foreground border-t-frame shrink-0 px-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4 sm:pb-[env(safe-area-inset-bottom)]">
        <div className="flex min-h-12 items-center gap-2 pl-2.5">
          <Icon name="search" className="text-muted-foreground shrink-0" />
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
            className="placeholder:text-muted-foreground/50 font-ui min-w-0 flex-1 bg-transparent py-1 text-base outline-none sm:text-sm"
          />
          {query ? (
            <IconButton
              icon="close"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              aria-label="clear search"
              className="flex size-11 items-center justify-center"
            />
          ) : (
            <span aria-hidden className="size-11 shrink-0" />
          )}
        </div>
      </div>
      <div ref={setPanelSlot} className="absolute inset-x-0 bottom-0" />

      <ItemDialog
        {...editor.dialogProps}
        bucketReminders={editingBucket?.defaultReminders}
        assigneeChoice={
          editingItem && {
            bucketId: editingItem.bucketId,
            members,
            value: editor.assigneeIds,
            onChange: editor.setAssigneeIds,
          }
        }
        statuses={statuses}
        fields={fields.length > 0 ? fields : undefined}
        panel={
          panelSlot
            ? {
                slot: panelSlot,
                bucketName: editingBucket?.name,
                onCollapsed: () => inputRef.current?.focus(),
              }
            : undefined
        }
      />
    </>
  );
}

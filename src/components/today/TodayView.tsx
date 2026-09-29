import { useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { BracketButton } from "@/components/ui/BracketButton";
import { ItemRow } from "@/components/buckets/ItemRow";
import { ItemDialog } from "@/components/buckets/ItemDialog";
import { useItemEditor } from "@/components/buckets/useItemEditor";
import { parseFields } from "@/components/buckets/fields";
import { BUCKET_PALETTE, DEFAULT_BUCKET_STATUSES } from "@/components/buckets/constants";
import { ITEM_STATUS, UPCOMING_DAYS } from "@/constants";
import type { items } from "@/lib/db/schema";
import { groupForToday } from "./group";
import { useTodayItems } from "./useTodayItems";

type Item = typeof items.$inferSelect;

const HINT = "text-muted-foreground font-mono text-xs";

export function TodayView() {
  const [query, setQuery] = useState("");
  const { data, refetch, changeStatus } = useTodayItems(query);
  const searching = query.trim().length > 0;
  const statuses = DEFAULT_BUCKET_STATUSES;
  const editor = useItemEditor({
    bucketId: 0,
    items: data?.items ?? [],
    defaultStatus: statuses.find((s) => s.isDefault)?.name ?? ITEM_STATUS.active,
    defaultDeadline: () => "",
    onSaved: refetch,
  });

  const bucketOf = (item: Item) => data?.buckets.find((b) => b.id === item.bucketId);
  const editingBucket = data?.items.find((i) => i.id === editor.editingItemId);
  const editingFields = editingBucket ? parseFields(bucketOf(editingBucket)?.fieldSchema) : [];
  const sections = searching
    ? [{ label: `${data?.items.length ?? 0} found`, items: data?.items ?? [] }]
    : groupForToday(data?.items ?? []);

  function row(item: Item) {
    const bucket = bucketOf(item);
    return (
      <ItemRow
        key={item.id}
        item={item}
        statuses={statuses}
        fields={bucket ? parseFields(bucket.fieldSchema) : []}
        isEditing={editor.editingItemId === item.id}
        onEditStart={() => editor.startEditing(item)}
        onStatusChange={(status) => void changeStatus(item, status)}
        reminderBadge={data?.reminderBadges[item.id]}
        bucket={
          bucket && {
            name: bucket.icon ? `${bucket.icon} ${bucket.name}` : bucket.name,
            color: BUCKET_PALETTE[bucket.index % BUCKET_PALETTE.length] ?? "",
          }
        }
      />
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="flex shrink-0 items-center gap-1.5 font-mono text-sm">
          <Clock size={13} aria-hidden />
          today
        </span>
        <input
          type="text"
          inputMode="search"
          enterKeyHint="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search all items…"
          aria-label="search all items"
          maxLength={200}
          className="border-border placeholder:text-muted-foreground/50 focus:border-foreground min-w-0 flex-1 border-b bg-transparent py-1 font-mono text-xs outline-none"
        />
        {searching && (
          <BracketButton onClick={() => setQuery("")} aria-label="clear search">
            x
          </BracketButton>
        )}
      </div>

      <div className="border-border overflow-hidden border-y-2 sm:mx-4 sm:border-x-2 sm:shadow-[2px_2px_0_var(--border)]">
        {!data ? (
          <p className={cn(HINT, "px-4 py-6 text-center")}>loading...</p>
        ) : data.items.length === 0 || sections.length === 0 ? (
          <p className={cn(HINT, "px-4 py-6 text-center")}>
            {searching ? "no items match" : `nothing due in the next ${UPCOMING_DAYS} days`}
          </p>
        ) : (
          sections.map((section) => (
            <section key={section.label} aria-label={section.label}>
              <p
                className={cn(
                  HINT,
                  "bg-card border-border border-b px-3 py-1.5",
                  section.label === "overdue" && "text-destructive"
                )}
              >
                {section.label}
              </p>
              <div className="divide-border divide-y divide-dashed">{section.items.map(row)}</div>
            </section>
          ))
        )}
      </div>

      <ItemDialog
        {...editor.dialogProps}
        statuses={statuses}
        fields={editingFields.length > 0 ? editingFields : undefined}
      />
    </div>
  );
}

"use client";

import { useState } from "react";
import { ItemDialog } from "./ItemDialog";
import { ItemList } from "./ItemList";
import { BucketSettings } from "./BucketSettings";
import type { SettingsTab } from "./BucketSettingsForm";
import { RemindersOffNotice } from "./RemindersOffNotice";
import { useBucketItems } from "./useBucketItems";
import { useItemEditor } from "./useItemEditor";
import { BracketButton } from "@/components/ui/BracketButton";
import { daysToDisplayStr, parseDurationToDate } from "@/lib/duration";
import type { ItemsRulesConfig } from "./constants";
import { DEFAULT_BUCKET_STATUSES } from "./constants";
import type { buckets } from "@/lib/db/schema";
import { BucketSchema } from "@/types/rules";
import type { FieldDef } from "@/types/rules";

type BucketRow = typeof buckets.$inferSelect;

interface BucketContentProps {
  bucket: BucketRow;
  accentColor: string;
}

function parseItemsRules(json: string): ItemsRulesConfig {
  try {
    return JSON.parse(json) as ItemsRulesConfig;
  } catch {
    return {};
  }
}

function parseFields(fieldSchema: unknown): FieldDef[] {
  try {
    if (!fieldSchema) return [];
    const raw = fieldSchema as string;
    return BucketSchema.parse(typeof raw === "string" ? JSON.parse(raw) : raw).fields;
  } catch {
    return [];
  }
}

export function BucketContent({ bucket, accentColor }: BucketContentProps) {
  const rules = parseItemsRules(bucket.itemsRules);
  const statuses = DEFAULT_BUCKET_STATUSES;
  const fields = parseFields(bucket.fieldSchema);
  const defaultStatus = statuses.find((s) => s.isDefault)?.name ?? statuses[0]?.name ?? "active";
  const readonly = rules.readonly === true;

  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);
  const list = useBucketItems(bucket.id, bucket.itemsRules, rules.showCompleted !== false);
  const editor = useItemEditor({
    bucketId: bucket.id,
    items: list.items,
    defaultStatus,
    defaultDeadline: () =>
      rules.defaultDeadlineOffsetDays !== null && rules.defaultDeadlineOffsetDays !== undefined
        ? (parseDurationToDate(daysToDisplayStr(rules.defaultDeadlineOffsetDays)) ?? "")
        : "",
    onSaved: list.refetch,
  });

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          <span
            className="h-3.5 w-0.5 shrink-0 rounded-full"
            style={{ backgroundColor: accentColor }}
          />
          <span className="font-pixel min-w-0 truncate overflow-hidden text-sm leading-snug">
            {bucket.icon ? `${bucket.icon} ${bucket.name}` : bucket.name}
          </span>
          <span className="text-muted-foreground/40 shrink-0 font-mono text-[10px]">
            #{bucket.id}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <BracketButton onClick={() => setSettingsTab("items")} className="px-1 py-1.5">
            settings
          </BracketButton>
          {!readonly && (
            <BracketButton onClick={editor.startAdding} className="px-1 py-1.5">
              add +
            </BracketButton>
          )}
        </div>
      </div>

      <RemindersOffNotice
        notificationsRules={bucket.notificationsRules}
        hasDatedItems={list.items.some((i) => i.deadline && i.status !== "completed")}
        onSetUp={() => setSettingsTab("notifications")}
      />

      <div
        className="border-border mx-4 overflow-hidden border-2"
        style={{ boxShadow: "2px 2px 0 var(--border)" }}
      >
        <ItemList
          loading={list.loading}
          items={list.orderedItems}
          orderedItemsRef={list.orderedItemsRef}
          draggable={rules.drag === true && rules.sortBy === "manual"}
          readonly={readonly}
          statuses={statuses}
          fields={fields}
          editingItemId={editor.editingItemId}
          reminderBadges={list.reminderBadges}
          onReorder={list.reorder}
          onEdit={editor.startEditing}
          onStatusChange={(item, status) => void list.changeStatus(item, status)}
          onDelete={(itemId) => void list.deleteItem(itemId)}
        />
      </div>

      <ItemDialog
        {...editor.dialogProps}
        statuses={statuses}
        fields={fields.length > 0 ? fields : undefined}
      />

      <BucketSettings
        open={settingsTab !== null}
        initialTab={settingsTab ?? undefined}
        bucket={bucket}
        onClose={() => setSettingsTab(null)}
      />
    </div>
  );
}

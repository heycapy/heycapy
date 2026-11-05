import { parseItemsRules, parseNotificationRules } from "@/lib/rules";
import { ITEM_STATUS, isClosedStatus } from "@/constants";
import { useEffect, useState, type RefObject } from "react";
import { ItemDialog } from "./ItemDialog";
import { ItemList } from "./ItemList";
import { BucketSettings } from "./BucketSettings";
import type { SettingsTab } from "./BucketSettingsForm";
import { RemindersOffNotice } from "./RemindersOffNotice";
import { TimezonesNotice } from "./TimezonesNotice";
import { useBucketItems } from "./useBucketItems";
import { useItemEditor } from "./useItemEditor";
import { useBucketMembers } from "./useBucketMembers";
import { daysToDisplayStr, parseDurationToDate } from "@/lib/duration";
import { DEFAULT_BUCKET_STATUSES } from "./constants";
import type { ViewerBucket } from "@/lib/buckets/access";
import { parseFields } from "./fields";
import { useUIStore } from "@/store/ui";
import { placesOf } from "@/lib/timezones/gap";
import { toast } from "sonner";
import { assignItemAction } from "@/app/(app)/actions";
import { memberName } from "@/lib/buckets/member-name";
import { MembersBar, type MemberFilter } from "./MembersBar";

type BucketContentProps = {
  bucket: ViewerBucket;
  accentColor: string;
  addItemRef: RefObject<(() => void) | null>;
};

export function BucketContent({ bucket, accentColor, addItemRef }: BucketContentProps) {
  const rules = parseItemsRules(bucket.itemsRules);
  const statuses = DEFAULT_BUCKET_STATUSES;
  const fields = parseFields(bucket.fieldSchema);
  const defaultStatus =
    statuses.find((s) => s.isDefault)?.name ?? statuses[0]?.name ?? ITEM_STATUS.active;
  const readonly = rules.readonly === true;
  const bucketName = bucket.icon ? `${bucket.icon} ${bucket.name}` : bucket.name;

  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);
  const list = useBucketItems(bucket.id, bucket.itemsRules, rules.showCompleted !== false);
  const editor = useItemEditor({
    bucketId: bucket.id,
    defaultStatus,
    defaultDeadline: () =>
      rules.defaultDeadlineOffsetDays !== null && rules.defaultDeadlineOffsetDays !== undefined
        ? (parseDurationToDate(daysToDisplayStr(rules.defaultDeadlineOffsetDays)) ?? "")
        : "",
    onSaved: list.refetch,
  });
  const members = useBucketMembers(bucket.id, editor.dialogProps.open);
  const membersRequested = useUIStore((s) => s.membersRequested);
  const clearMembersRequest = useUIStore((s) => s.clearMembersRequest);
  const settingsRequested = useUIStore((s) => s.settingsRequestedId === bucket.id);
  const clearSettingsRequest = useUIStore((s) => s.clearSettingsRequest);
  const [filter, setFilter] = useState<MemberFilter>("all");
  const shared = members.length > 1;
  const filtered =
    typeof filter === "number" ? members.find((m) => m.userId === filter) : undefined;
  const activeFilter = shared && (typeof filter !== "number" || filtered) ? filter : "all";
  const assigneeShown =
    activeFilter === "mine" ? members.find((m) => m.isYou)?.userId : activeFilter;
  const shownItems =
    activeFilter === "all"
      ? list.orderedItems
      : list.orderedItems.filter((i) => i.assigneeId === assigneeShown);
  const openTab: SettingsTab | null =
    settingsTab ?? (membersRequested ? "members" : settingsRequested ? "items" : null);
  useEffect(() => {
    addItemRef.current = editor.startAdding;
    return () => {
      addItemRef.current = null;
    };
  });

  return (
    <div className="flex flex-col">
      <h2 className="sr-only">{bucketName}</h2>

      {shared && (
        <MembersBar
          members={members}
          filter={activeFilter}
          onFilter={setFilter}
          onOpenMembers={() => setSettingsTab("members")}
        />
      )}

      <TimezonesNotice members={members} />

      <RemindersOffNotice
        myChannels={bucket.myChannels}
        hasDatedItems={list.items.some((i) => i.deadline && !isClosedStatus(i.status))}
        onSetUp={() => setSettingsTab("notifications")}
      />

      <div className="border-border @container overflow-hidden border-b-2 sm:mx-4 sm:border-x-2 sm:shadow-[2px_2px_0_var(--border)]">
        <ItemList
          loading={list.loading}
          items={shownItems}
          emptyText={
            activeFilter === "all"
              ? undefined
              : `nothing assigned to ${filtered ? memberName(filtered) : "you"}`
          }
          orderedItemsRef={list.orderedItemsRef}
          // A filtered list is only part of the order, so dragging in it would scramble the rest
          draggable={rules.drag === true && rules.sortBy === "manual" && activeFilter === "all"}
          shared={shared}
          onAssign={async (item, assigneeId) => {
            const result = await assignItemAction(item.id, assigneeId);
            if (!result.ok) toast.error(result.error);
            await list.refetch();
            return result.ok;
          }}
          readonly={readonly}
          statuses={statuses}
          fields={fields}
          color={accentColor}
          editingItemId={editor.editingItemId}
          reminderBadges={list.reminderBadges}
          members={members}
          onReorder={list.reorder}
          onEdit={editor.startEditing}
          onStatusChange={(item, status) => void list.changeStatus(item, status)}
          onMove={(item, deadline) => list.moveItem(item, deadline)}
          onDelete={(itemId) => void list.deleteItem(itemId)}
        />
      </div>

      <ItemDialog
        {...editor.dialogProps}
        assigneeChoice={{
          bucketId: bucket.id,
          members,
          value: editor.assigneeId,
          onChange: editor.setAssigneeId,
        }}
        bucketReminders={parseNotificationRules(bucket.notificationsRules).defaultReminders}
        statuses={statuses}
        fields={fields.length > 0 ? fields : undefined}
      />

      <BucketSettings
        open={openTab !== null}
        initialTab={openTab ?? undefined}
        bucket={bucket}
        clocksDiffer={placesOf(members).differ}
        onClose={() => {
          setSettingsTab(null);
          clearMembersRequest();
          clearSettingsRequest();
        }}
      />
    </div>
  );
}

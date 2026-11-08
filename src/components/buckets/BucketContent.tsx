import { parseItemsRules, parseNotificationRules } from "@/lib/rules";
import { ITEM_STATUS, isClosedStatus } from "@/constants";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { ItemDialog } from "./ItemDialog";
import type { ItemPanel } from "./ItemPanelFrame";
import { ItemList } from "./ItemList";
import { BucketSettings } from "./BucketSettings";
import type { SettingsTab } from "./BucketSettingsForm";
import { RemindersOffNotice } from "./RemindersOffNotice";
import { TimezonesNotice } from "./TimezonesNotice";
import { useBucketItems } from "./useBucketItems";
import { useItemEditor } from "./useItemEditor";
import { useBucketMembers } from "./useBucketMembers";
import { defaultDeadline } from "./defaultDeadline";
import { DEFAULT_BUCKET_STATUSES } from "./constants";
import type { ViewerBucket } from "@/lib/buckets/access";
import { parseFields } from "./fields";
import { useUIStore } from "@/store/ui";
import { useLayoutStore } from "@/store/layout";
import { placesOf } from "@/lib/timezones/gap";
import { notify } from "@/components/ui/notify";
import { useLookParts } from "@/components/looks/LookProvider";
import { cn } from "@/lib/utils";
import { assignItemAction } from "@/app/(app)/actions";
import { memberName } from "@/lib/buckets/member-name";
import { MembersBar, type MemberFilter } from "./MembersBar";

// What the footer's add box reaches into the open bucket for
export type BucketView = {
  startAdding: () => void;
  refetch: () => Promise<void>;
};

type BucketContentProps = {
  bucket: ViewerBucket;
  accentColor: string;
  viewRef: RefObject<BucketView | null>;
  panel?: Omit<ItemPanel, "bucketName">;
};

export function BucketContent({ bucket, accentColor, viewRef, panel }: BucketContentProps) {
  const rules = parseItemsRules(bucket.itemsRules);
  const statuses = DEFAULT_BUCKET_STATUSES;
  const fields = parseFields(bucket.fieldSchema);
  const defaultStatus =
    statuses.find((s) => s.isDefault)?.name ?? statuses[0]?.name ?? ITEM_STATUS.active;
  const readonly = rules.readonly === true;
  const bucketName = bucket.icon ? `${bucket.icon} ${bucket.name}` : bucket.name;
  const framed = useLookParts().listFrame === "framed";

  const list = useBucketItems(bucket.id, bucket.itemsRules, rules.showCompleted !== false);
  const editor = useItemEditor({
    bucketId: bucket.id,
    defaultStatus,
    defaultDeadline: () => defaultDeadline(rules.defaultDeadlineOffsetDays),
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
  const settingsTab = useLayoutStore((s) =>
    s.sidePanel === "bucket-settings" && s.bucketSettings?.bucketId === bucket.id
      ? s.bucketSettings.tab
      : null
  );
  const openBucketSettings = useLayoutStore((s) => s.openBucketSettings);
  const closeSidePanel = useLayoutStore((s) => s.closeSidePanel);
  const openSettings = useCallback(
    (tab: SettingsTab) => openBucketSettings(bucket.id, tab),
    [openBucketSettings, bucket.id]
  );

  const settingsOpenRef = useRef(false);
  useEffect(() => {
    settingsOpenRef.current = settingsTab !== null;
  }, [settingsTab]);
  useEffect(
    () => () => {
      if (settingsOpenRef.current) closeSidePanel("bucket-settings");
    },
    [closeSidePanel]
  );

  useEffect(() => {
    if (!membersRequested && !settingsRequested) return;
    openSettings(membersRequested ? "members" : "items");
    clearMembersRequest();
    clearSettingsRequest();
  }, [
    membersRequested,
    settingsRequested,
    openSettings,
    clearMembersRequest,
    clearSettingsRequest,
  ]);
  useEffect(() => {
    viewRef.current = { startAdding: editor.startAdding, refetch: list.refetch };
    return () => {
      viewRef.current = null;
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
          onOpenMembers={() => openSettings("members")}
        />
      )}

      <TimezonesNotice members={members} />

      <RemindersOffNotice
        myChannels={bucket.myChannels}
        hasDatedItems={list.items.some((i) => i.deadline && !isClosedStatus(i.status))}
        onSetUp={() => openSettings("notifications")}
      />

      <div
        className={cn(
          "@container overflow-hidden sm:mx-4",
          framed &&
            "border-border border-b-frame sm:border-x-frame sm:shadow-raised-sm sm:rounded-b-panel"
        )}
      >
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
            if (!result.ok) notify.error(result.error);
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
          onStatusChange={list.changeStatus}
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
        panel={panel && { ...panel, bucketName }}
      />

      <BucketSettings
        open={settingsTab !== null}
        initialTab={settingsTab ?? undefined}
        bucket={bucket}
        clocksDiffer={placesOf(members).differ}
        onClose={() => {
          closeSidePanel("bucket-settings");
        }}
      />
    </div>
  );
}

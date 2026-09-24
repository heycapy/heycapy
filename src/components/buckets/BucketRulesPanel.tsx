"use client";

import { Toggle } from "@/components/ui/Toggle";
import { OptionGroup } from "@/components/ui/OptionGroup";
import { TimePicker } from "@/components/ui/TimePicker";
import { DurationInput } from "@/components/ui/DurationInput";
import type { SortBy, NotificationMedium, RepeatMode } from "./constants";
import { SORT_OPTIONS, MEDIUM_OPTIONS, REPEAT_OPTIONS } from "./constants";

const LABEL = "text-muted-foreground font-mono text-[10px]";
const HINT = "text-muted-foreground/50 font-mono text-[9px] leading-tight";

interface BucketRulesPanelProps {
  activeTab: "items" | "notifications";
  disabled?: boolean;
  sortBy: SortBy;
  drag: boolean;
  showCompleted: boolean;
  readonly: boolean;
  defaultDeadlineOffset: string;
  mediums: NotificationMedium[];
  notifyAt: string;
  defaultOffset: string;
  repeat: RepeatMode;
  onSortByChange: (v: SortBy) => void;
  onDragChange: (v: boolean) => void;
  onShowCompletedChange: (v: boolean) => void;
  onReadonlyChange: (v: boolean) => void;
  onDefaultDeadlineOffsetChange: (v: string) => void;
  onMediumToggle: (m: NotificationMedium) => void;
  onNotifyAtChange: (v: string) => void;
  onDefaultOffsetChange: (v: string) => void;
  onRepeatChange: (v: RepeatMode) => void;
}

export function BucketRulesPanel({
  activeTab,
  disabled,
  sortBy,
  drag,
  showCompleted,
  readonly,
  defaultDeadlineOffset,
  mediums,
  notifyAt,
  defaultOffset,
  repeat,
  onSortByChange,
  onDragChange,
  onShowCompletedChange,
  onReadonlyChange,
  onDefaultDeadlineOffsetChange,
  onMediumToggle,
  onNotifyAtChange,
  onDefaultOffsetChange,
  onRepeatChange,
}: BucketRulesPanelProps) {
  if (activeTab === "items") {
    return (
      <>
        <div className="flex flex-col gap-1.5">
          <label className={LABEL}>sort by</label>
          <span className={HINT}>how items are ordered in this bucket</span>
          <OptionGroup options={SORT_OPTIONS} value={sortBy} onChange={onSortByChange} />
        </div>
        {sortBy === "manual" && (
          <div className="flex flex-col gap-1.5">
            <label className={LABEL}>allow drag</label>
            <span className={HINT}>let you drag items to reorder them manually</span>
            <Toggle value={drag} onChange={onDragChange} />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <label className={LABEL}>show completed</label>
          <span className={HINT}>keep completed items visible in the list</span>
          <Toggle value={showCompleted} onChange={onShowCompletedChange} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={LABEL}>read only</label>
          <span className={HINT}>prevent adding or editing items (useful for synced buckets)</span>
          <Toggle value={readonly} onChange={onReadonlyChange} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={LABEL}>default deadline offset</label>
          <span className={HINT}>
            when adding an item, pre-fill the deadline this far from today
          </span>
          <DurationInput
            value={defaultDeadlineOffset}
            onChange={onDefaultDeadlineOffsetChange}
            placeholder="e.g. 7 days, 2 weeks"
            disabled={disabled}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>medium</label>
        <span className={HINT}>where to send notifications — ntfy is push, email is inbox</span>
        <OptionGroup options={MEDIUM_OPTIONS} value={mediums} onChange={onMediumToggle} multi />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>remind me before deadline</label>
        <span className={HINT}>
          how far in advance to notify — leave empty to notify at the deadline
        </span>
        <DurationInput
          value={defaultOffset}
          onChange={onDefaultOffsetChange}
          placeholder="e.g. 3 days, 1 hour — empty = at deadline"
          disabled={disabled}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>notify at</label>
        <span className={HINT}>
          if the early reminder lands at an odd hour, this delays it — e.g. deadline 6am + remind 6h
          early triggers at midnight, set notify at 5am to get it at 5am instead
        </span>
        <TimePicker value={notifyAt} onChange={onNotifyAtChange} disabled={disabled} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>repeat</label>
        <span className={HINT}>
          once = one notification when the reminder triggers, never again · daily = keeps notifying
          once per day from that point until the item is completed
        </span>
        <OptionGroup options={REPEAT_OPTIONS} value={repeat} onChange={onRepeatChange} />
      </div>
    </>
  );
}

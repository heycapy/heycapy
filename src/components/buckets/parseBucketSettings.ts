import { daysToDisplayStr, minsToDisplayStr } from "@/lib/duration";
import type { NotificationMedium, RepeatMode, SortBy } from "./constants";
import type { buckets } from "@/lib/db/schema";

type BucketRow = typeof buckets.$inferSelect;

type RawItemsRules = {
  sortBy?: string;
  sort_by?: string;
  drag?: boolean;
  readonly?: boolean;
  showCompleted?: boolean;
  show_completed?: boolean;
  defaultDeadlineOffsetDays?: number | null;
  default_deadline_offset?: string | null;
};

type RawNotifRules = {
  medium?: NotificationMedium[];
  notifyAt?: string;
  notify_at?: string;
  defaultOffsetMins?: number;
  default_offset?: string;
  repeat?: RepeatMode;
};

export type BucketSettingsValues = {
  name: string;
  sortBy: SortBy;
  drag: boolean;
  showCompleted: boolean;
  readonly: boolean;
  defaultDeadlineOffset: string;
  mediums: NotificationMedium[];
  notifyAt: string;
  defaultOffset: string;
  repeat: RepeatMode;
  notifyOnArrival: boolean;
  notifyWhenOverdue: boolean;
  overdueRepeatHours: number | undefined;
};

function parseJson<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

function parseFieldSchema(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

// Also accepts the legacy snake_case keys older buckets were saved with
export function parseBucketSettings(bucket: BucketRow): BucketSettingsValues {
  const ir = parseJson<RawItemsRules>(bucket.itemsRules, {});
  const nr = parseJson<RawNotifRules>(bucket.notificationsRules, {});
  const fs = parseFieldSchema(bucket.fieldSchema);

  return {
    name: bucket.name,
    sortBy: ((ir.sortBy ?? ir.sort_by) as SortBy | undefined) ?? "created_at",
    drag: ir.drag ?? false,
    showCompleted: (ir.showCompleted ?? ir.show_completed) !== false,
    readonly: ir.readonly ?? false,
    defaultDeadlineOffset:
      ir.defaultDeadlineOffsetDays !== null && ir.defaultDeadlineOffsetDays !== undefined
        ? daysToDisplayStr(ir.defaultDeadlineOffsetDays)
        : (ir.default_deadline_offset ?? ""),
    mediums: nr.medium ?? [],
    notifyAt: nr.notifyAt ?? nr.notify_at ?? "",
    defaultOffset:
      nr.defaultOffsetMins !== undefined && nr.defaultOffsetMins !== null
        ? minsToDisplayStr(nr.defaultOffsetMins)
        : (nr.default_offset ?? ""),
    repeat: nr.repeat ?? "once",
    notifyOnArrival: fs.notifyOnArrival === true,
    notifyWhenOverdue: fs.notifyWhenOverdue === true,
    overdueRepeatHours:
      typeof fs.overdueRepeatHours === "number" ? fs.overdueRepeatHours : undefined,
  };
}

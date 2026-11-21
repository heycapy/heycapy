import { isClosedStatus } from "@/constants";
import type { ItemId } from "@/types/ids";
import type { ItemsRules } from "@/types/rules";
import type { ListItem, ReminderBadge } from "@/lib/reminders/status";
import type { StoredRecord, WireRecord } from "./types";

type ItemData = Extract<WireRecord, { entity: "item" }>["data"];
type ReminderData = Extract<WireRecord, { entity: "item_reminder" }>["data"];

const date = (value: string | null) => (value === null ? null : new Date(value));

function reviveItem(d: ItemData) {
  return {
    ...d,
    deadline: date(d.deadline),
    scheduledAt: date(d.scheduledAt),
    notifiedAt: date(d.notifiedAt),
    overdueNotifiedAt: date(d.overdueNotifiedAt),
    remindNotBefore: date(d.remindNotBefore),
    completedAt: date(d.completedAt),
    deletedAt: date(d.deletedAt),
    createdAt: new Date(d.createdAt),
    updatedAt: new Date(d.updatedAt),
  };
}

// An item as the person sees it: their own reminder times, none when they aren't reminded about it
function asViewer(item: ReturnType<typeof reviveItem>, mine: ReminderData | undefined) {
  return {
    ...item,
    nextReminderAt: date(mine?.nextReminderAt ?? null),
    nextOverdueAt: date(mine?.nextOverdueAt ?? null),
    ...(mine && {
      notifiedAt: date(mine.notifiedAt),
      overdueNotifiedAt: date(mine.overdueNotifiedAt),
    }),
  };
}

const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const time = (d: Date | null) => d?.getTime() ?? null;

// The same orders the server lists a bucket in
const ORDERS: Record<NonNullable<ItemsRules["sortBy"]>, (a: ListItem, b: ListItem) => number> = {
  manual: (a, b) =>
    a.sortOrder - b.sortOrder ||
    a.createdAt.getTime() - b.createdAt.getTime() ||
    compareText(a.id, b.id),
  created_at: (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || compareText(a.id, b.id),
  deadline: (a, b) => {
    const [x, y] = [time(a.deadline), time(b.deadline)];
    if (x === null && y !== null) return 1;
    if (x !== null && y === null) return -1;
    return (
      (x ?? 0) - (y ?? 0) ||
      a.createdAt.getTime() - b.createdAt.getTime() ||
      compareText(a.id, b.id)
    );
  },
};

export function listBucketItems(
  records: StoredRecord[],
  bucketId: number,
  sortBy: NonNullable<ItemsRules["sortBy"]>
): ListItem[] {
  const members = new Set<number>();
  const reminders = new Map<string, ReminderData>();
  for (const r of records) {
    if (r.entity === "bucket_member" && r.data.bucketId === bucketId) members.add(r.data.userId);
    if (r.entity === "item_reminder") reminders.set(r.id, r.data);
  }
  const listed: ListItem[] = [];
  for (const r of records) {
    if (r.entity !== "item" || r.data.bucketId !== bucketId || r.data.deletedAt !== null) continue;
    listed.push({
      ...asViewer(reviveItem(r.data), reminders.get(r.id)),
      // The item's own list is the server's view when it was read, a member may have left since
      assigneeIds: r.data.assigneeIds.filter((id) => members.has(id)),
    });
  }
  return listed.sort(ORDERS[sortBy]);
}

// What can be known on the device: whether a reminder is coming. A failed delivery and a missing
// channel live on the server and are added when it can be reached
export function localBadges(list: ListItem[]): Record<ItemId, ReminderBadge> {
  const badges: Record<ItemId, ReminderBadge> = {};
  for (const item of list) {
    if (!item.deadline) continue;
    badges[item.id] = !isClosedStatus(item.status) && item.nextReminderAt ? "upcoming" : "history";
  }
  return badges;
}

const SERVER_ONLY: ReminderBadge[] = ["failed", "noChannel"];

// The server's word on delivery wins for an open item, whatever the device worked out. It was
// read earlier, so it never speaks for an item that has since been closed or lost its date
export function withServerBadges(
  list: ListItem[],
  local: Record<ItemId, ReminderBadge>,
  server: Record<ItemId, ReminderBadge>
): Record<ItemId, ReminderBadge> {
  const badges = { ...local };
  for (const item of list) {
    const said = server[item.id];
    if (said && SERVER_ONLY.includes(said) && item.deadline && !isClosedStatus(item.status)) {
      badges[item.id] = said;
    }
  }
  return badges;
}

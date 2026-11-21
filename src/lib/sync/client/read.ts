import { isClosedStatus, ITEM_STATUS } from "@/constants";
import { patchedDeadline, patchedRecurring } from "@/lib/items/patch-rules";
import type { ItemId } from "@/types/ids";
import type { ItemsRules } from "@/types/rules";
import type { ListItem, ReminderBadge } from "@/lib/reminders/status";
import type { NewMutation, QueueEntry, StoredRecord, WireRecord } from "./types";

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

// What the person asked for and the server has not confirmed: shown on top of the synced rows, so
// a pull can never put an older copy over an unsent edit, and a refused one just stops showing
export type QueuedChanges = { queue: QueueEntry[]; userId: number; zone: string; now: Date };

type Create = Extract<NewMutation, { type: "item.create" }>;

function provisional(
  m: Create,
  bucketId: number,
  sortOrder: number,
  memberIds: number[],
  q: QueuedChanges
): ListItem {
  const { deadline, deadlineTimezone } = patchedDeadline(
    { deadline: null, deadlineTimezone: null, scheduledAt: null },
    m.deadline,
    m.clock ?? q.zone,
    m.recurring ?? null
  );
  const completed = m.status === ITEM_STATUS.completed;
  return {
    id: m.id,
    bucketId,
    userId: q.userId,
    title: m.title.trim(),
    description: m.description?.trim() || null,
    deadline,
    deadlineTimezone,
    scheduledAt: null,
    status: m.status ?? ITEM_STATUS.active,
    properties: m.properties ? JSON.stringify(m.properties) : null,
    externalId: null,
    externalUrl: null,
    reminderOffsets: m.reminders ?? null,
    notifiedAt: null,
    overdueNotifiedAt: null,
    remindNotBefore: null,
    sortOrder,
    recurring: m.recurring?.enabled ? JSON.stringify(m.recurring) : null,
    source: "manual",
    completedAt: completed ? q.now : null,
    completedBy: completed ? q.userId : null,
    deletedAt: null,
    deletedBy: null,
    createdAt: q.now,
    updatedAt: q.now,
    rev: 0,
    assigneeIds: m.assigneeIds ?? memberIds,
    nextReminderAt: null,
    nextOverdueAt: null,
  };
}

function patched(
  item: ListItem,
  patch: Extract<NewMutation, { type: "item.patch" }>["patch"],
  q: QueuedChanges
): ListItem {
  const recurring = patchedRecurring(patch.recurring, item.recurring);
  const due =
    patch.deadline !== undefined
      ? patchedDeadline(item, patch.deadline, patch.clock ?? q.zone, recurring)
      : null;
  const wasCompleted = item.status === ITEM_STATUS.completed;
  const nowCompleted = patch.status === ITEM_STATUS.completed;
  const title = patch.title?.trim();
  return {
    ...item,
    ...(title && { title }),
    ...(patch.description !== undefined && { description: patch.description?.trim() || null }),
    ...(due && {
      deadline: due.deadline,
      deadlineTimezone: due.deadlineTimezone,
      ...(!due.keepsMovedDate && { scheduledAt: null }),
    }),
    ...(patch.status !== undefined && { status: patch.status }),
    ...(patch.status !== undefined &&
      nowCompleted !== wasCompleted && {
        completedAt: nowCompleted ? q.now : null,
        completedBy: nowCompleted ? q.userId : null,
      }),
    ...(patch.recurring !== undefined && {
      recurring: recurring ? JSON.stringify(recurring) : null,
    }),
    ...(patch.properties !== undefined && {
      properties: patch.properties ? JSON.stringify(patch.properties) : null,
    }),
    ...(patch.reminders !== undefined && { reminderOffsets: patch.reminders }),
    ...(patch.assigneeIds && { assigneeIds: patch.assigneeIds }),
    updatedAt: q.now,
  };
}

function withQueuedChanges(
  list: ListItem[],
  bucketId: number,
  memberIds: number[],
  q: QueuedChanges
): ListItem[] {
  const byId = new Map(list.map((i) => [i.id, i]));
  for (const { mutation } of q.queue) {
    if (mutation.type === "item.create") {
      // Already here when the server applied it and the answer is still on its way
      if (mutation.bucketId !== bucketId || byId.has(mutation.id)) continue;
      const sortOrder = Math.max(-1, ...[...byId.values()].map((i) => i.sortOrder)) + 1;
      byId.set(mutation.id, provisional(mutation, bucketId, sortOrder, memberIds, q));
    } else if (mutation.type === "item.patch") {
      const item = byId.get(mutation.id);
      if (item) byId.set(mutation.id, patched(item, mutation.patch, q));
    } else byId.delete(mutation.id);
  }
  return [...byId.values()];
}

export function listBucketItems(
  records: StoredRecord[],
  bucketId: number,
  sortBy: NonNullable<ItemsRules["sortBy"]>,
  queued?: QueuedChanges
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
  const shown = queued ? withQueuedChanges(listed, bucketId, [...members], queued) : listed;
  return shown.sort(ORDERS[sortBy]);
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

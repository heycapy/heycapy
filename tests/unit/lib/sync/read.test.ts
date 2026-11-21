import { describe, expect, it } from "vitest";
import { recordKey } from "@/lib/sync/client/apply";
import {
  listBucketItems,
  localBadges,
  withServerBadges,
  type QueuedChanges,
} from "@/lib/sync/client/read";
import type { NewMutation, StoredRecord, WireRecord } from "@/lib/sync/client/types";

type ItemData = Extract<WireRecord, { entity: "item" }>["data"];

const id = (n: number) => `00000000-0000-7000-8000-${String(n).padStart(12, "0")}`;

function item(n: number, over: Partial<ItemData> = {}): StoredRecord {
  const data: ItemData = {
    id: id(n),
    bucketId: 1,
    userId: 1,
    title: `item ${n}`,
    description: null,
    deadline: null,
    deadlineTimezone: null,
    scheduledAt: null,
    status: "active",
    properties: null,
    externalId: null,
    externalUrl: null,
    reminderOffsets: null,
    notifiedAt: null,
    overdueNotifiedAt: null,
    remindNotBefore: null,
    sortOrder: n,
    recurring: null,
    source: "manual",
    completedAt: null,
    completedBy: null,
    deletedAt: null,
    deletedBy: null,
    createdAt: "2026-03-10T12:00:00.000Z",
    updatedAt: "2026-03-10T12:00:00.000Z",
    rev: n,
    assigneeIds: [],
    ...over,
  };
  return {
    entity: "item",
    id: data.id,
    rev: n,
    data,
    key: recordKey("item", data.id),
    bucketId: data.bucketId,
  };
}
const reminder = (n: number, next: string | null): StoredRecord => ({
  entity: "item_reminder",
  id: id(n),
  rev: 1,
  data: {
    itemId: id(n),
    notifiedAt: "2026-03-10T10:00:00.000Z",
    overdueNotifiedAt: null,
    nextReminderAt: next,
    nextOverdueAt: null,
  },
  key: recordKey("item_reminder", id(n)),
  bucketId: null,
});
const member = (memberId: number, userId: number, bucketId = 1): StoredRecord => ({
  entity: "bucket_member",
  id: memberId,
  rev: 1,
  data: {
    bucketId,
    userId,
    role: "member",
    sortOrder: null,
    channels: null,
    username: "u",
    avatar: null,
  },
  key: recordKey("bucket_member", memberId),
  bucketId,
});

describe("listBucketItems", () => {
  it("lists one bucket's items with their dates as dates", () => {
    const [row] = listBucketItems(
      [
        item(1, { deadline: "2026-04-01T09:00:00.000Z", deletedAt: null }),
        item(2, { bucketId: 2 }),
      ],
      1,
      "manual"
    );
    expect(row.deadline).toEqual(new Date("2026-04-01T09:00:00.000Z"));
    expect(row.createdAt).toBeInstanceOf(Date);
    expect(row.completedAt).toBeNull();
  });

  it("hides what is in the trash", () => {
    const list = listBucketItems(
      [item(1), item(2, { deletedAt: "2026-03-11T00:00:00.000Z" })],
      1,
      "manual"
    );
    expect(list.map((i) => i.id)).toEqual([id(1)]);
  });

  it("gives the person's own reminder times and none when there is no reminder row", () => {
    const [withRow, without] = listBucketItems(
      [item(1), item(2), reminder(1, "2026-04-01T08:00:00.000Z")],
      1,
      "manual"
    );
    expect(withRow.nextReminderAt).toEqual(new Date("2026-04-01T08:00:00.000Z"));
    expect(withRow.notifiedAt).toEqual(new Date("2026-03-10T10:00:00.000Z"));
    expect(without.nextReminderAt).toBeNull();
    expect(without.nextOverdueAt).toBeNull();
  });

  it("drops assignees who are no longer members", () => {
    const [row] = listBucketItems(
      [item(1, { assigneeIds: [1, 2, 3] }), member(10, 1), member(11, 3), member(12, 2, 9)],
      1,
      "manual"
    );
    expect(row.assigneeIds).toEqual([1, 3]);
  });

  it("orders by hand, then created time, then id", () => {
    const list = listBucketItems(
      [
        item(1, { sortOrder: 2 }),
        item(2, { sortOrder: 1, createdAt: "2026-03-10T12:00:05.000Z" }),
        item(3, { sortOrder: 1 }),
        item(4, { sortOrder: 1 }),
      ],
      1,
      "manual"
    );
    expect(list.map((i) => i.id)).toEqual([id(3), id(4), id(2), id(1)]);
  });

  it("orders by deadline with undated items last", () => {
    const list = listBucketItems(
      [
        item(1),
        item(2, { deadline: "2026-05-01T00:00:00.000Z" }),
        item(3, { deadline: "2026-04-01T00:00:00.000Z" }),
        item(4),
      ],
      1,
      "deadline"
    );
    expect(list.map((i) => i.id)).toEqual([id(3), id(2), id(1), id(4)]);
  });

  it("orders by created time", () => {
    const list = listBucketItems(
      [
        item(1, { createdAt: "2026-03-10T12:00:09.000Z" }),
        item(2, { createdAt: "2026-03-10T12:00:01.000Z" }),
      ],
      1,
      "created_at"
    );
    expect(list.map((i) => i.id)).toEqual([id(2), id(1)]);
  });
});

describe("badges", () => {
  const dated = (n: number, over: Partial<ItemData> = {}) =>
    item(n, { deadline: "2026-04-01T09:00:00.000Z", ...over });

  it("says upcoming for an open dated item with a reminder coming, history otherwise", () => {
    const list = listBucketItems(
      [
        dated(1),
        reminder(1, "2026-04-01T08:00:00.000Z"),
        dated(2),
        dated(3, { status: "completed" }),
        reminder(3, "2026-04-01T08:00:00.000Z"),
        item(4),
      ],
      1,
      "manual"
    );
    expect(localBadges(list)).toEqual({
      [id(1)]: "upcoming",
      [id(2)]: "history",
      [id(3)]: "history",
    });
  });

  it("takes the server's failed and no-channel for an open item only", () => {
    const list = listBucketItems(
      [dated(1), dated(2, { status: "completed" }), dated(3), item(4)],
      1,
      "manual"
    );
    const local = localBadges(list);
    const merged = withServerBadges(list, local, {
      [id(1)]: "failed",
      [id(2)]: "failed",
      [id(3)]: "upcoming",
      [id(4)]: "noChannel",
      [id(9)]: "failed",
    });
    expect(merged).toEqual({ [id(1)]: "failed", [id(2)]: "history", [id(3)]: "history" });
  });
});

describe("changes not sent yet", () => {
  const NOW = new Date("2026-03-12T10:00:00.000Z");
  const queued = (...mutations: NewMutation[]): QueuedChanges => ({
    queue: mutations.map((mutation, i) => ({ seq: i + 1, sent: false, mutation })),
    userId: 1,
    zone: "UTC",
    now: NOW,
  });
  const create = (n: number, over: Record<string, unknown> = {}): NewMutation =>
    ({
      type: "item.create",
      id: id(n),
      bucketId: 1,
      title: ` new ${n} `,
      deadline: null,
      ...over,
    }) as NewMutation;
  const patch = (n: number, p: Record<string, unknown>): NewMutation =>
    ({ type: "item.patch", id: id(n), patch: p }) as NewMutation;
  const list = (records: StoredRecord[], q: QueuedChanges) =>
    listBucketItems(records, 1, "manual", q);

  it("shows a created item at the end of the list, for everyone in the bucket", () => {
    const rows = list([item(1), member(10, 1), member(11, 2)], queued(create(2)));
    expect(rows.map((i) => i.id)).toEqual([id(1), id(2)]);
    expect(rows[1]).toMatchObject({
      title: "new 2",
      sortOrder: 2,
      status: "active",
      userId: 1,
      assigneeIds: [1, 2],
      createdAt: NOW,
    });
  });

  it("reads a created item's date on the clock it was set on", () => {
    const [row] = list([], queued(create(1, { deadline: "2026-04-01", clock: "Asia/Kolkata" })));
    expect(row.deadlineTimezone).toBe("Asia/Kolkata");
    expect(row.deadline).toEqual(new Date("2026-03-31T18:30:00.000Z"));
  });

  it("shows an edit, a tick and a delete over the synced rows", () => {
    const rows = list(
      [item(1), item(2), item(3)],
      queued(
        patch(1, { title: " renamed ", description: "a note" }),
        patch(2, { status: "completed" }),
        { type: "item.delete", id: id(3) }
      )
    );
    expect(rows.map((i) => i.id)).toEqual([id(1), id(2)]);
    expect(rows[0]).toMatchObject({ title: "renamed", description: "a note", updatedAt: NOW });
    expect(rows[1]).toMatchObject({ status: "completed", completedAt: NOW, completedBy: 1 });
  });

  it("an untick clears who completed it", () => {
    const [row] = list(
      [item(1, { status: "completed", completedAt: "2026-03-11T00:00:00.000Z", completedBy: 2 })],
      queued(patch(1, { status: "active" }))
    );
    expect(row).toMatchObject({ status: "active", completedAt: null, completedBy: null });
  });

  it("saving a completed item as completed again keeps who completed it and when", () => {
    const [row] = list(
      [item(1, { status: "completed", completedAt: "2026-03-11T00:00:00.000Z", completedBy: 2 })],
      queued(patch(1, { status: "completed" }))
    );
    expect(row).toMatchObject({
      completedAt: new Date("2026-03-11T00:00:00.000Z"),
      completedBy: 2,
    });
  });

  it("applies several edits in the order they were made", () => {
    const [row] = list(
      [item(1)],
      queued(patch(1, { title: "a" }), patch(1, { title: "b", assigneeIds: [4] }))
    );
    expect(row).toMatchObject({ title: "b", assigneeIds: [4] });
  });

  it("an edit that clears the date and one that sets it", () => {
    const rows = list(
      [item(1, { deadline: "2026-04-01T09:00:00.000Z", deadlineTimezone: "UTC" }), item(2)],
      queued(patch(1, { deadline: null }), patch(2, { deadline: "2026-05-01T08:00:00" }))
    );
    expect(rows[0]).toMatchObject({ deadline: null, deadlineTimezone: null });
    expect(rows[1].deadline).toEqual(new Date("2026-05-01T08:00:00.000Z"));
  });

  it("does not add a created item the synced rows already have, but still applies its edits", () => {
    const rows = list(
      [item(1, { title: "from server" })],
      queued(create(1), patch(1, { title: "edited" }))
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("edited");
    expect(rows[0].createdAt).toEqual(new Date("2026-03-10T12:00:00.000Z"));
  });

  it("ignores a change to an item that is not in this list", () => {
    const rows = list([item(1)], queued(patch(9, { title: "x" }), create(5, { bucketId: 2 })));
    expect(rows.map((i) => i.id)).toEqual([id(1)]);
  });

  it("a change the server refused stops showing once it leaves the queue", () => {
    const records = [item(1, { title: "kept" })];
    expect(list(records, queued(patch(1, { title: "refused" })))[0].title).toBe("refused");
    expect(list(records, queued())[0].title).toBe("kept");
  });
});

import { describe, expect, it } from "vitest";
import { recordKey } from "@/lib/sync/client/apply";
import { listBucketItems, localBadges, withServerBadges } from "@/lib/sync/client/read";
import type { StoredRecord, WireRecord } from "@/lib/sync/client/types";

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

import type { ItemId } from "@/types/ids";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq, gt, inArray, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  bucketMembers,
  buckets,
  itemAssignees,
  itemReminders,
  items,
  syncState,
  syncTombstones,
  users,
} from "@/lib/db/schema";
import { TOMBSTONE_RETENTION_DAYS } from "@/constants";
import { executeToolCall } from "@/lib/ai/capyTools";
import { createItem, softDeleteItemById } from "@/app/api/telegram/telegram-utils";
import { setItemAssignees } from "@/lib/items/assignees";
import { restoreItem } from "@/lib/items/trash";
import { completeItem } from "@/lib/reminders/quick-actions";
import { pruneTombstones } from "@/lib/sync/tombstones";
import {
  HOUR,
  MINUTE,
  resetSchedulerEnvironment,
  runSchedulerAt,
  seedBucket,
  seedItem,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

const T0 = new Date("2026-03-10T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => useSchedulerEnvironment(T0));
afterEach(() => resetSchedulerEnvironment());

const counter = () => db.select().from(syncState).get()?.rev ?? -1;
const minRev = () => db.select().from(syncState).get()?.minRev ?? -1;
const itemRow = (id: ItemId) => db.select().from(items).where(eq(items.id, id)).get();
const tombstonesAfter = (rev: number) =>
  db.select().from(syncTombstones).where(gt(syncTombstones.rev, rev)).all();

function bare(userId: number, bucketId: number, title = "pay rent") {
  return db.insert(items).values({ bucketId, userId, title }).returning().get();
}

describe("revisions", () => {
  it("every write takes the next number from one counter", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);

    const before = counter();
    const item = bare(userId, bucketId);
    expect(counter()).toBe(before + 1);
    expect(itemRow(item.id)?.rev).toBe(before + 1);

    db.update(items).set({ title: "pay the rent" }).where(eq(items.id, item.id)).run();
    expect(counter()).toBe(before + 2);
    expect(itemRow(item.id)?.rev).toBe(before + 2);

    // A write that changes nothing is still a write, a device that sees one more row is harmless
    db.update(items).set({ title: "pay the rent" }).where(eq(items.id, item.id)).run();
    expect(counter()).toBe(before + 3);
    expect(itemRow(item.id)?.rev).toBe(before + 3);
  });

  it("gives all four synced tables distinct numbers, the highest being the counter", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);
    await seedItem(userId, bucketId, { deadline: new Date(T0.getTime() + HOUR) });
    await seedItem(userId, bucketId, { deadline: new Date(T0.getTime() + 2 * HOUR) });

    const revs = [
      ...db.select({ rev: buckets.rev }).from(buckets).all(),
      ...db.select({ rev: bucketMembers.rev }).from(bucketMembers).all(),
      ...db.select({ rev: items.rev }).from(items).all(),
      ...db.select({ rev: itemReminders.rev }).from(itemReminders).all(),
    ].map((r) => r.rev);

    expect(revs.every((rev) => rev > 0)).toBe(true);
    expect(new Set(revs).size).toBe(revs.length);
    expect(Math.max(...revs)).toBe(counter());
  });

  it("counts a new bucket and the owner's membership the trigger adds as two writes", async () => {
    const userId = await seedUser();
    const before = counter();

    const [bucket] = await db.insert(buckets).values({ userId, name: "home" }).returning();

    expect(counter()).toBe(before + 2);
    const member = db
      .select()
      .from(bucketMembers)
      .where(eq(bucketMembers.bucketId, bucket.id))
      .get();
    expect(member?.rev).toBe(counter());
    expect(db.select().from(buckets).where(eq(buckets.id, bucket.id)).get()?.rev).toBeLessThan(
      counter()
    );
  });
});

describe("an assignee change is an item change", () => {
  it("stamps the item without touching its updated time", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);
    const item = bare(userId, bucketId);
    const before = counter();

    db.insert(itemAssignees).values({ itemId: item.id, userId }).run();
    expect(counter()).toBe(before + 1);
    expect(itemRow(item.id)).toMatchObject({ rev: before + 1, updatedAt: item.updatedAt });

    db.delete(itemAssignees).where(eq(itemAssignees.itemId, item.id)).run();
    expect(counter()).toBe(before + 2);
    expect(itemRow(item.id)?.rev).toBe(before + 2);
  });

  it("does not stamp an item that is being deleted along with its assignees", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);
    const item = bare(userId, bucketId);
    db.insert(itemAssignees).values({ itemId: item.id, userId }).run();
    const before = counter();

    db.delete(items).where(eq(items.id, item.id)).run();

    expect(counter()).toBe(before + 1);
    expect(tombstonesAfter(before).map((t) => t.entity)).toEqual(["item"]);
  });
});

describe("the writers in the app all stamp", () => {
  it("a new item from Telegram", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);
    const before = counter();

    const id = await createItem(userId, bucketId, "buy milk", null);

    expect(id).not.toBeNull();
    expect(itemRow(id as ItemId)?.rev).toBeGreaterThan(before);
  });

  it("ticking an item, and putting it in the trash and back", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);
    const id = await seedItem(userId, bucketId, { deadline: new Date(T0.getTime() + HOUR) });

    let seen = itemRow(id)?.rev ?? 0;
    await completeItem(userId, id, "telegram");
    expect(itemRow(id)?.rev).toBeGreaterThan(seen);

    seen = itemRow(id)?.rev ?? 0;
    await softDeleteItemById(userId, id);
    expect(itemRow(id)?.deletedAt).not.toBeNull();
    expect(itemRow(id)?.rev).toBeGreaterThan(seen);

    seen = itemRow(id)?.rev ?? 0;
    await restoreItem(userId, id, T0);
    expect(itemRow(id)?.deletedAt).toBeNull();
    expect(itemRow(id)?.rev).toBeGreaterThan(seen);
  });

  it("changing who an item is for", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);
    const id = await seedItem(userId, bucketId, { deadline: new Date(T0.getTime() + HOUR) });
    const seen = itemRow(id)?.rev ?? 0;

    setItemAssignees(db, id, []);

    expect(itemRow(id)?.rev).toBeGreaterThan(seen);
  });

  it("an edit made by capy", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);
    const id = await seedItem(userId, bucketId, { deadline: new Date(T0.getTime() + HOUR) });
    const seen = itemRow(id)?.rev ?? 0;

    const result = JSON.parse(
      await executeToolCall(
        { id: "call", name: "update_item", arguments: { item_id: id, title: "pay the landlord" } },
        userId,
        "UTC"
      )
    ) as { ok: boolean };

    expect(result.ok).toBe(true);
    expect(itemRow(id)?.rev).toBeGreaterThan(seen);
  });

  it("the scheduler marking a person reminded stamps their reminder, and not the item", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);
    const deadline = new Date(T0.getTime() + HOUR);
    const id = await seedItem(userId, bucketId, { deadline });
    const seen = counter();
    const itemRev = itemRow(id)?.rev;

    await runSchedulerAt(new Date(deadline.getTime() + MINUTE));

    const reminders = db.select().from(itemReminders).where(eq(itemReminders.itemId, id)).all();
    expect(reminders.length).toBe(1);
    expect(reminders[0].notifiedAt).not.toBeNull();
    expect(reminders[0].rev).toBeGreaterThan(seen);
    expect(itemRow(id)?.rev).toBe(itemRev);
  });

  it("a person changing their name or picture stamps their memberships and nobody else's", async () => {
    const owner = await seedUser();
    const other = await seedUser();
    const shared = await seedBucket(owner);
    const alone = await seedBucket(other);
    db.insert(bucketMembers).values({ bucketId: shared, userId: other }).run();
    const memberships = (userId: number) =>
      db.select().from(bucketMembers).where(eq(bucketMembers.userId, userId)).all();
    const seen = counter();

    db.update(users)
      .set({ username: `renamed-${Date.now()}` })
      .where(eq(users.id, other))
      .run();

    expect(memberships(other).length).toBe(2);
    expect(memberships(other).every((m) => m.rev > seen)).toBe(true);
    expect(memberships(owner).every((m) => m.rev <= seen)).toBe(true);
    expect(alone).toBeGreaterThan(0);
  });

  it("deleting the person who ticked an item, which only clears the name on it", async () => {
    const owner = await seedUser();
    const doer = await seedUser();
    const bucketId = await seedBucket(owner);
    const item = bare(owner, bucketId);
    db.update(items).set({ completedBy: doer }).where(eq(items.id, item.id)).run();
    const seen = counter();

    db.delete(users).where(eq(users.id, doer)).run();

    expect(itemRow(item.id)).toMatchObject({ completedBy: null });
    expect(itemRow(item.id)?.rev).toBeGreaterThan(seen);
  });
});

describe("tombstones", () => {
  it("records a deleted item with the revision of the delete", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);
    const item = bare(userId, bucketId);
    const before = counter();

    db.delete(items).where(eq(items.id, item.id)).run();

    const [tombstone, ...rest] = tombstonesAfter(before);
    expect(rest).toEqual([]);
    expect(tombstone).toMatchObject({
      rev: counter(),
      entity: "item",
      entityId: item.id,
      bucketId,
      userId: null,
    });
    expect(tombstone.createdAt).toBeInstanceOf(Date);
  });

  it("does not record a move to the trash, that is an ordinary change", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);
    const item = bare(userId, bucketId);
    const before = counter();

    db.update(items).set({ deletedAt: T0 }).where(eq(items.id, item.id)).run();

    expect(tombstonesAfter(before)).toEqual([]);
    expect(itemRow(item.id)?.rev).toBe(before + 1);
  });

  it("records everything that goes with a bucket when it is deleted", async () => {
    const owner = await seedUser();
    const member = await seedUser();
    const bucketId = await seedBucket(owner);
    db.insert(bucketMembers).values({ bucketId, userId: member }).run();
    const first = await seedItem(owner, bucketId, { deadline: new Date(T0.getTime() + HOUR) });
    const second = await seedItem(owner, bucketId, { deadline: new Date(T0.getTime() + 2 * HOUR) });
    const reminderCount = db
      .select()
      .from(itemReminders)
      .where(inArray(itemReminders.itemId, [first, second]))
      .all().length;
    expect(reminderCount).toBeGreaterThan(0);
    const before = counter();

    db.delete(buckets).where(eq(buckets.id, bucketId)).run();

    const gone = tombstonesAfter(before);
    const of = (entity: string) => gone.filter((t) => t.entity === entity);
    expect(of("bucket").map((t) => t.entityId)).toEqual([String(bucketId)]);
    expect(of("bucket_member").map((t) => t.userId)).toEqual(
      expect.arrayContaining([owner, member])
    );
    expect(of("bucket_member").every((t) => t.bucketId === bucketId)).toBe(true);
    expect(of("item").map((t) => t.entityId)).toEqual(expect.arrayContaining([first, second]));
    expect(of("item").every((t) => t.bucketId === bucketId)).toBe(true);
    expect(of("item_reminder").length).toBe(reminderCount);
    expect(of("item_reminder").every((t) => [first, second].includes(t.entityId))).toBe(true);
    expect(new Set(gone.map((t) => t.rev)).size).toBe(gone.length);
    expect(Math.max(...gone.map((t) => t.rev))).toBe(counter());
  });

  it("tells the member who left, with the bucket and the person", async () => {
    const owner = await seedUser();
    const member = await seedUser();
    const bucketId = await seedBucket(owner);
    db.insert(bucketMembers).values({ bucketId, userId: member }).run();
    const before = counter();

    db.delete(bucketMembers)
      .where(and(eq(bucketMembers.bucketId, bucketId), eq(bucketMembers.userId, member)))
      .run();

    expect(tombstonesAfter(before)).toMatchObject([
      { entity: "bucket_member", bucketId, userId: member },
    ]);
  });

  it("records the reminders of a person whose account is deleted, for that person", async () => {
    const owner = await seedUser();
    const member = await seedUser();
    const bucketId = await seedBucket(owner);
    db.insert(bucketMembers).values({ bucketId, userId: member }).run();
    const id = await seedItem(owner, bucketId, { deadline: new Date(T0.getTime() + HOUR) });
    const theirs = db
      .select()
      .from(itemReminders)
      .where(and(eq(itemReminders.itemId, id), eq(itemReminders.userId, member)))
      .all();
    expect(theirs.length).toBe(1);
    const before = counter();

    db.delete(users).where(eq(users.id, member)).run();

    const reminders = tombstonesAfter(before).filter((t) => t.entity === "item_reminder");
    expect(reminders).toMatchObject([{ entityId: id, userId: member, bucketId: null }]);
  });
});

describe("pruning tombstones", () => {
  const NOW = new Date("2026-06-01T00:00:00Z");

  function tombstone(daysOld: number) {
    return db
      .insert(syncTombstones)
      .values({
        rev: counter() + 1,
        entity: "item",
        entityId: `old-${daysOld}-${Math.random()}`,
        createdAt: new Date(NOW.getTime() - daysOld * DAY),
      })
      .returning()
      .get();
  }

  function bump() {
    const next = counter() + 1;
    db.update(syncState).set({ rev: next }).run();
    return next;
  }

  it("drops what is past its retention and records how far, keeping the rest", () => {
    const old = tombstone(TOMBSTONE_RETENTION_DAYS + 5);
    bump();
    const recent = tombstone(TOMBSTONE_RETENTION_DAYS - 5);
    bump();

    expect(pruneTombstones(NOW)).toBeGreaterThanOrEqual(1);

    const left = db.select().from(syncTombstones).all();
    expect(left.some((t) => t.rev === old.rev)).toBe(false);
    expect(left.some((t) => t.rev === recent.rev)).toBe(true);
    expect(minRev()).toBeGreaterThanOrEqual(old.rev);
    expect(minRev()).toBeLessThan(recent.rev);
  });

  it("leaves nothing at or below the recorded revision, even when the clock went backwards", () => {
    const first = tombstone(1);
    bump();
    const second = tombstone(TOMBSTONE_RETENTION_DAYS + 30);
    bump();

    pruneTombstones(NOW);

    expect(db.select().from(syncTombstones).where(lte(syncTombstones.rev, minRev())).all()).toEqual(
      []
    );
    expect(minRev()).toBeGreaterThanOrEqual(second.rev);
    expect(first.rev).toBeLessThan(second.rev);
  });

  it("does nothing when nothing is old, and a second run changes nothing", () => {
    tombstone(1);
    bump();
    pruneTombstones(NOW);
    const settled = { min: minRev(), left: db.select().from(syncTombstones).all().length };

    expect(pruneTombstones(NOW)).toBe(0);

    expect({ min: minRev(), left: db.select().from(syncTombstones).all().length }).toEqual(settled);
  });

  it("never lowers the recorded revision", () => {
    tombstone(TOMBSTONE_RETENTION_DAYS + 5);
    bump();
    pruneTombstones(NOW);
    const raised = minRev();

    tombstone(TOMBSTONE_RETENTION_DAYS + 1);
    bump();
    pruneTombstones(NOW);

    expect(minRev()).toBeGreaterThanOrEqual(raised);
  });
});

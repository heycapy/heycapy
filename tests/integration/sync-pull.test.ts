import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import type * as SessionModule from "@/lib/auth/session";
import { db } from "@/lib/db";
import { bucketMembers, buckets, itemReminders, items, syncState } from "@/lib/db/schema";
import { SYNC_PROTOCOL_HEADER, SYNC_PROTOCOL_VERSION } from "@/constants";
import { executeToolCall } from "@/lib/ai/capyTools";
import { setItemAssignees } from "@/lib/items/assignees";
import { deleteItemForever } from "@/lib/items/trash";
import { pull, type PullRecord, type PullTombstone } from "@/lib/sync/pull";
import { pruneTombstones } from "@/lib/sync/tombstones";
import { GET } from "@/app/api/v1/sync/pull/route";
import {
  HOUR,
  resetSchedulerEnvironment,
  seedBucket,
  seedItem,
  seedMember,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

const session = vi.hoisted(() => ({ userId: 0, email: "", signedIn: true }));
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof SessionModule>()),
  getSession: async () => (session.signedIn ? session : null),
  requireApiSession: async () =>
    session.signedIn ? [session, null] : [null, new Response("Unauthorized", { status: 401 })],
}));

const T0 = new Date("2026-03-10T12:00:00Z");

beforeEach(() => {
  useSchedulerEnvironment(T0);
  session.signedIn = true;
});
afterEach(() => resetSchedulerEnvironment());

const counter = () => db.select().from(syncState).get()?.rev ?? 0;
const later = () => new Date(T0.getTime() + HOUR);

function fetchPage(userId: number, cursor: number, limit = 1000) {
  const result = pull(db, userId, cursor, limit);
  if (result.reset) throw new Error("unexpected reset");
  return result;
}

// What a client keeps, changed the way the protocol says a client must apply a page:
// every delete first, then every row
class Device {
  rows = new Map<string, PullRecord>();
  cursor = 0;
  pages = 0;

  constructor(private readonly userId: number) {}

  sync(limit = 1000) {
    for (;;) {
      const page = fetchPage(this.userId, this.cursor, limit);
      this.pages++;
      for (const t of page.tombstones) this.remove(t);
      for (const r of page.records) this.rows.set(`${r.entity}:${r.id}`, r);
      this.cursor = page.cursor;
      if (!page.more) return;
    }
  }

  private remove(t: PullTombstone) {
    const dropBucket = (bucketId: number) => {
      for (const [key, row] of this.rows) {
        const inside =
          (row.entity === "bucket" && row.id === bucketId) ||
          (row.entity === "bucket_member" && row.data.bucketId === bucketId) ||
          (row.entity === "item" && row.data.bucketId === bucketId);
        if (inside) this.rows.delete(key);
      }
      for (const [key, row] of this.rows) {
        if (row.entity === "item_reminder" && !this.rows.has(`item:${row.data.itemId}`)) {
          this.rows.delete(key);
        }
      }
    };
    if (t.entity === "bucket") dropBucket(Number(t.id));
    else if (t.entity === "bucket_member") {
      if (t.userId === this.userId && t.bucketId !== null) dropBucket(t.bucketId);
      else this.rows.delete(`bucket_member:${t.id}`);
    } else if (t.entity === "item") {
      const local = this.rows.get(`item:${t.id}`);
      if (local?.entity === "item" && local.data.bucketId === t.bucketId) {
        this.rows.delete(`item:${t.id}`);
      }
    } else this.rows.delete(`item_reminder:${t.id}`);
  }

  keys() {
    return [...this.rows.values()].map((r) => `${r.entity}:${r.id}@${r.rev}`).sort();
  }
}

// What the server says this person can see, read straight from the tables
function visible(userId: number): string[] {
  const mine = db
    .select({ id: bucketMembers.bucketId })
    .from(bucketMembers)
    .where(eq(bucketMembers.userId, userId))
    .all()
    .map((r) => r.id);
  const keys: string[] = [];
  for (const b of db.select().from(buckets).where(inArray(buckets.id, mine)).all()) {
    keys.push(`bucket:${b.id}@${b.rev}`);
  }
  for (const m of db
    .select()
    .from(bucketMembers)
    .where(inArray(bucketMembers.bucketId, mine))
    .all()) {
    keys.push(`bucket_member:${m.id}@${m.rev}`);
  }
  for (const i of db.select().from(items).where(inArray(items.bucketId, mine)).all()) {
    keys.push(`item:${i.id}@${i.rev}`);
    for (const r of db
      .select()
      .from(itemReminders)
      .where(and(eq(itemReminders.itemId, i.id), eq(itemReminders.userId, userId)))
      .all()) {
      keys.push(`item_reminder:${r.itemId}@${r.rev}`);
    }
  }
  return keys.sort();
}

async function shared() {
  const owner = await seedUser();
  const friend = await seedUser();
  const bucketId = await seedBucket(owner);
  await seedMember(bucketId, friend);
  const id = await seedItem(owner, bucketId, {
    deadline: new Date(T0.getTime() + HOUR),
    assigneeIds: [owner, friend],
  });
  return { owner, friend, bucketId, id };
}

describe("a first pull", () => {
  it("returns everything the person can see, and nothing else", async () => {
    const { owner, friend, bucketId, id } = await shared();
    const outsider = await seedUser();
    const theirs = await seedBucket(outsider);
    await seedItem(outsider, theirs, { deadline: later() });

    const page = fetchPage(friend, 0);

    expect(page.more).toBe(false);
    expect(page.cursor).toBe(counter());
    const keys = page.records.map((r) => `${r.entity}:${r.id}`);
    expect(keys).toContain(`bucket:${bucketId}`);
    expect(keys).toContain(`item:${id}`);
    expect(page.records.filter((r) => r.entity === "bucket_member")).toHaveLength(2);
    expect(page.records.filter((r) => r.entity === "bucket")).toHaveLength(1);
    expect(page.records.filter((r) => r.entity === "item")).toHaveLength(1);
    expect(page.tombstones).toEqual([]);
    const item = page.records.find((r) => r.entity === "item");
    expect(item?.entity === "item" && item.data.assigneeIds).toEqual([owner, friend]);
  });

  it("sends a person's own reminders and only theirs", async () => {
    const { owner, friend, id } = await shared();

    const mine = fetchPage(friend, 0).records.filter((r) => r.entity === "item_reminder");
    const theirs = fetchPage(owner, 0).records.filter((r) => r.entity === "item_reminder");

    expect(mine.map((r) => r.id)).toEqual([id]);
    expect(theirs.map((r) => r.id)).toEqual([id]);
    const rows = db.select().from(itemReminders).where(eq(itemReminders.itemId, id)).all();
    expect(rows.map((r) => r.userId).sort()).toEqual([owner, friend].sort());
  });

  it("keeps the owner's integration settings and other people's channels on the server", async () => {
    const { owner, friend, bucketId } = await shared();
    db.update(buckets)
      .set({
        webhookKey: "secret-key",
        telegramConfig: "secret-telegram",
        mcpConfig: "secret-mcp",
        mcpIntegration: "linear",
      })
      .where(eq(buckets.id, bucketId))
      .run();
    db.update(bucketMembers)
      .set({ channels: '{"medium":["email"],"webhooks":[]}' })
      .where(and(eq(bucketMembers.bucketId, bucketId), eq(bucketMembers.userId, owner)))
      .run();

    const page = fetchPage(friend, 0);

    expect(JSON.stringify(page)).not.toMatch(/secret-|linear|webhookKey|telegramConfig|mcpConfig/);
    const members = page.records.flatMap((r) => (r.entity === "bucket_member" ? [r.data] : []));
    expect(members.find((m) => m.userId === owner)?.channels).toBeNull();
    expect(members.find((m) => m.userId === friend)?.channels).toEqual(expect.any(String));
  });
});

describe("following the cursor", () => {
  it("returns nothing new, then only what changed", async () => {
    const { owner, friend, id } = await shared();
    const device = new Device(friend);
    device.sync();

    const idle = fetchPage(friend, device.cursor);
    expect(idle).toMatchObject({ more: false, records: [], tombstones: [], cursor: device.cursor });

    db.update(items).set({ title: "pay the rent" }).where(eq(items.id, id)).run();
    const changed = fetchPage(friend, device.cursor);
    expect(changed.records.map((r) => `${r.entity}:${r.id}`)).toEqual([`item:${id}`]);
    expect(owner).toBeGreaterThan(0);
  });

  it("pages through a long change list and ends where one big page would", async () => {
    const { owner, friend, bucketId } = await shared();
    for (let i = 0; i < 12; i++) {
      await seedItem(owner, bucketId, { deadline: later(), title: `item ${i}` });
    }
    const paged = new Device(friend);
    paged.sync(5);
    const whole = new Device(friend);
    whole.sync(1000);

    expect(paged.pages).toBeGreaterThan(3);
    expect(paged.keys()).toEqual(whole.keys());
    expect(paged.cursor).toBe(whole.cursor);
    expect(paged.keys()).toEqual(visible(friend));
  });

  it("moves the cursor forward on every page", async () => {
    const { owner, friend, bucketId } = await shared();
    for (let i = 0; i < 6; i++) await seedItem(owner, bucketId, { deadline: later() });
    const seen: number[] = [];
    let cursor = 0;
    for (;;) {
      const page = fetchPage(friend, cursor, 4);
      seen.push(page.cursor);
      cursor = page.cursor;
      if (!page.more) break;
    }
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(new Set(seen).size).toBe(seen.length);
  });
});

describe("access is part of the feed", () => {
  it("a person who joins is sent the whole bucket, including what is older than their cursor", async () => {
    const { owner, bucketId, id } = await shared();
    const newcomer = await seedUser();
    const device = new Device(newcomer);
    device.sync();
    expect(device.keys()).toEqual([]);

    await seedMember(bucketId, newcomer);
    device.sync();

    expect(device.keys()).toEqual(visible(newcomer));
    expect(device.rows.has(`item:${id}`)).toBe(true);
    expect(device.rows.has(`bucket:${bucketId}`)).toBe(true);
    expect(owner).toBeGreaterThan(0);
  });

  it("a person who is removed loses the bucket, and the others see the member go", async () => {
    const { owner, friend, bucketId, id } = await shared();
    const removed = new Device(friend);
    const staying = new Device(owner);
    removed.sync();
    staying.sync();
    expect(removed.rows.has(`item:${id}`)).toBe(true);

    db.delete(bucketMembers)
      .where(and(eq(bucketMembers.bucketId, bucketId), eq(bucketMembers.userId, friend)))
      .run();
    removed.sync();
    staying.sync();

    expect(removed.keys()).toEqual([]);
    expect(staying.keys()).toEqual(visible(owner));
    expect(staying.keys().filter((k) => k.startsWith("bucket_member:"))).toHaveLength(1);
  });

  it("a person who is removed and added again gets the bucket back", async () => {
    const { friend, bucketId, id } = await shared();
    const device = new Device(friend);
    device.sync();

    db.delete(bucketMembers)
      .where(and(eq(bucketMembers.bucketId, bucketId), eq(bucketMembers.userId, friend)))
      .run();
    await seedMember(bucketId, friend);
    device.sync();

    expect(device.rows.has(`item:${id}`)).toBe(true);
    expect(device.keys()).toEqual(visible(friend));
  });

  it("a person is not sent what is changed in a bucket they have left", async () => {
    const { owner, friend, bucketId, id } = await shared();
    const device = new Device(friend);
    device.sync();
    db.delete(bucketMembers)
      .where(and(eq(bucketMembers.bucketId, bucketId), eq(bucketMembers.userId, friend)))
      .run();
    device.sync();

    db.update(items).set({ title: "secret plans" }).where(eq(items.id, id)).run();
    const page = fetchPage(friend, device.cursor);

    expect(page.records).toEqual([]);
    expect(owner).toBeGreaterThan(0);
  });
});

describe("deletes", () => {
  it("an item deleted for good is gone from every member's device", async () => {
    const { owner, friend, id } = await shared();
    db.update(items).set({ deletedAt: T0, deletedBy: owner }).where(eq(items.id, id)).run();
    const devices = [new Device(owner), new Device(friend)];
    devices.forEach((d) => d.sync());
    expect(devices.every((d) => d.rows.has(`item:${id}`))).toBe(true);

    expect(await deleteItemForever(owner, id)).toBe("deleted");
    devices.forEach((d) => d.sync());

    for (const d of devices) {
      expect(d.rows.has(`item:${id}`)).toBe(false);
      expect(d.rows.has(`item_reminder:${id}`)).toBe(false);
    }
  });

  it("an item moved to another bucket leaves the old bucket's devices and reaches the new one's", async () => {
    const { owner, friend, id } = await shared();
    const other = await seedBucket(owner);
    const alone = await seedUser();
    await seedMember(other, alone);
    const devices = {
      friend: new Device(friend),
      alone: new Device(alone),
      owner: new Device(owner),
    };
    Object.values(devices).forEach((d) => d.sync());

    const reply = await executeToolCall(
      { id: "t", name: "move_item", arguments: { item_id: id, bucket_id: other } },
      owner,
      "UTC"
    );
    expect(JSON.parse(reply)).toMatchObject({ ok: true });
    Object.values(devices).forEach((d) => d.sync());

    expect(devices.friend.rows.has(`item:${id}`)).toBe(false);
    expect(devices.alone.rows.has(`item:${id}`)).toBe(true);
    expect(devices.owner.rows.has(`item:${id}`)).toBe(true);
    for (const [who, userId] of [
      ["friend", friend],
      ["alone", alone],
      ["owner", owner],
    ] as const) {
      expect(devices[who].keys()).toEqual(visible(userId));
    }
  });

  it("a bucket deleted for good is gone from every member's device", async () => {
    const { owner, friend, bucketId } = await shared();
    const devices = [new Device(owner), new Device(friend)];
    devices.forEach((d) => d.sync());

    db.delete(buckets).where(eq(buckets.id, bucketId)).run();
    devices.forEach((d) => d.sync());

    expect(devices.map((d) => d.keys())).toEqual([[], []]);
  });

  it("an assignee taken off an item loses that item's reminder row", async () => {
    const { owner, friend, id } = await shared();
    const device = new Device(friend);
    device.sync();
    expect(device.rows.has(`item_reminder:${id}`)).toBe(true);

    setItemAssignees(db, id, [owner]);
    const { refreshItemReminders } = await import("@/lib/reminders/refresh");
    refreshItemReminders(db, [id]);
    device.sync();

    expect(device.rows.has(`item_reminder:${id}`)).toBe(false);
    expect(device.keys()).toEqual(visible(friend));
  });
});

describe("a device that follows every change", () => {
  it("ends up with exactly what the server shows, whatever happened in between", async () => {
    const { owner, friend, bucketId, id } = await shared();
    const newcomer = await seedUser();
    const devices = [new Device(owner), new Device(friend), new Device(newcomer)];
    const users = [owner, friend, newcomer];
    const syncAll = (limit?: number) => devices.forEach((d) => d.sync(limit));
    syncAll(3);

    const second = await seedItem(owner, bucketId, { deadline: later(), title: "second" });
    syncAll(3);
    await seedMember(bucketId, newcomer);
    db.update(items).set({ title: "renamed" }).where(eq(items.id, id)).run();
    syncAll(3);
    db.update(items).set({ deletedAt: T0, deletedBy: friend }).where(eq(items.id, second)).run();
    await deleteItemForever(owner, second);
    db.delete(bucketMembers)
      .where(and(eq(bucketMembers.bucketId, bucketId), eq(bucketMembers.userId, friend)))
      .run();
    syncAll(2);

    devices.forEach((d, i) => expect(d.keys()).toEqual(visible(users[i])));
  });
});

describe("starting over", () => {
  it("is asked for when the cursor is ahead of the server, as after a restored backup", async () => {
    const { friend } = await shared();
    expect(pull(db, friend, counter() + 1, 10)).toEqual({ reset: true });
  });

  it("is asked for when tombstones the device never saw have been pruned, but never at cursor 0", async () => {
    const { owner, friend, id } = await shared();
    const stale = new Device(friend);
    stale.sync();
    db.update(items).set({ deletedAt: T0, deletedBy: owner }).where(eq(items.id, id)).run();
    await deleteItemForever(owner, id);
    pruneTombstones(new Date("2100-01-01T00:00:00Z"));
    const { minRev } = db.select().from(syncState).get() ?? { minRev: 0 };
    expect(minRev).toBeGreaterThan(stale.cursor);

    expect(pull(db, friend, stale.cursor, 10)).toEqual({ reset: true });
    expect(pull(db, friend, minRev, 10)).toMatchObject({ reset: false });
    const fresh = new Device(friend);
    fresh.sync();
    expect(fresh.keys()).toEqual(visible(friend));
  });
});

describe("GET /api/v1/sync/pull", () => {
  const get = (query: string, version: string | null = String(SYNC_PROTOCOL_VERSION)) =>
    GET(
      new Request(`http://localhost/api/v1/sync/pull${query}`, {
        headers: version === null ? {} : { [SYNC_PROTOCOL_HEADER]: version },
      })
    );

  it("answers 401 without a session", async () => {
    session.signedIn = false;
    expect((await get("")).status).toBe(401);
  });

  it("wants the protocol version, and answers 426 to one that is no longer served", async () => {
    const { friend } = await shared();
    session.userId = friend;

    expect((await get("", null)).status).toBe(400);
    expect((await get("", "later")).status).toBe(400);
    const old = await get("", "0");
    expect(old.status).toBe(426);
    expect(await old.json()).toMatchObject({ minProtocol: 1 });
  });

  it("answers 400 to a bad cursor or limit", async () => {
    const { friend } = await shared();
    session.userId = friend;

    for (const query of ["?cursor=-1", "?cursor=abc", "?cursor=1.5", "?limit=0", "?limit=100000"]) {
      expect((await get(query)).status).toBe(400);
    }
  });

  it("returns the versions and the person's own data", async () => {
    const { friend, id } = await shared();
    session.userId = friend;

    const response = await get("");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ protocol: 1, schema: 1, reset: false, more: false });
    expect(
      body.records.map((r: { entity: string; id: string }) => `${r.entity}:${r.id}`)
    ).toContain(`item:${id}`);
  });

  it("answers reset when the cursor is ahead of the server", async () => {
    const { friend } = await shared();
    session.userId = friend;

    const body = await (await get(`?cursor=${counter() + 5}`)).json();

    expect(body).toMatchObject({ protocol: 1, schema: 1, reset: true });
  });
});

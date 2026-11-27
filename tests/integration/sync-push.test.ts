import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import type * as SessionModule from "@/lib/auth/session";
import { db } from "@/lib/db";
import { itemAssignees, items, syncDevices, users } from "@/lib/db/schema";
import {
  ITEM_GONE_ERROR,
  ITEM_STATUS,
  PUSH_MAX_MUTATIONS,
  SYNC_PROTOCOL_HEADER,
  SYNC_PROTOCOL_VERSION,
} from "@/constants";
import { newItemId } from "@/lib/items/item-id";
import { applyPush } from "@/lib/sync/push";
import { POST } from "@/app/api/v1/sync/push/route";
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

const itemOf = (id: string) => db.select().from(items).where(eq(items.id, id)).get();
const lastSeqOf = (userId: number, deviceId: string) =>
  db
    .select()
    .from(syncDevices)
    .where(and(eq(syncDevices.userId, userId), eq(syncDevices.deviceId, deviceId)))
    .get()?.lastSeq;
const assigneesOf = (id: string) =>
  db
    .select()
    .from(itemAssignees)
    .where(eq(itemAssignees.itemId, id))
    .all()
    .map((a) => a.userId);

async function setup() {
  const owner = await seedUser();
  const friend = await seedUser();
  const bucketId = await seedBucket(owner);
  await seedMember(bucketId, friend);
  return { owner, friend, bucketId, device: crypto.randomUUID() };
}

describe("applyPush", () => {
  it("applies a create, a patch and a delete in order, with the id the device chose", async () => {
    const { owner, bucketId, device } = await setup();
    const id = newItemId();

    const results = applyPush(
      db,
      owner,
      device,
      [
        { seq: 1, type: "item.create", id, bucketId, title: "pay rent", deadline: "2026-03-20" },
        { seq: 2, type: "item.patch", id, patch: { title: "pay the rent" } },
        { seq: 3, type: "item.patch", id, patch: { status: ITEM_STATUS.completed } },
      ],
      T0
    );

    expect(results).toEqual([
      { seq: 1, result: "applied" },
      { seq: 2, result: "applied" },
      { seq: 3, result: "applied" },
    ]);
    expect(itemOf(id)).toMatchObject({
      title: "pay the rent",
      status: ITEM_STATUS.completed,
      completedBy: owner,
      userId: owner,
    });
    expect(lastSeqOf(owner, device)).toBe(3);

    expect(applyPush(db, owner, device, [{ seq: 4, type: "item.delete", id }], T0)).toEqual([
      { seq: 4, result: "applied" },
    ]);
    expect(itemOf(id)?.deletedBy).toBe(owner);
  });

  it("changes nothing when the same changes are sent again", async () => {
    const { owner, friend, bucketId, device } = await setup();
    const id = newItemId();
    const batch = [
      { seq: 1, type: "item.create", id, bucketId, title: "a", deadline: null },
      { seq: 2, type: "item.patch", id, patch: { assigneeIds: [friend], title: "b" } },
    ];
    applyPush(db, owner, device, batch, T0);
    const after = { item: itemOf(id), assignees: assigneesOf(id) };

    const again = applyPush(db, owner, device, batch, new Date(T0.getTime() + HOUR));

    expect(again).toEqual([
      { seq: 1, result: "duplicate" },
      { seq: 2, result: "duplicate" },
    ]);
    expect({ item: itemOf(id), assignees: assigneesOf(id) }).toEqual(after);
  });

  it("applies only the new part of a batch that was partly sent before", async () => {
    const { owner, bucketId, device } = await setup();
    const [a, b] = [newItemId(), newItemId()];
    const first = { seq: 1, type: "item.create", id: a, bucketId, title: "a", deadline: null };
    const second = { seq: 2, type: "item.create", id: b, bucketId, title: "b", deadline: null };
    applyPush(db, owner, device, [first], T0);

    expect(applyPush(db, owner, device, [first, second], T0)).toEqual([
      { seq: 1, result: "duplicate" },
      { seq: 2, result: "applied" },
    ]);
    expect(itemOf(b)?.title).toBe("b");
  });

  it("refuses a change for good, moves on, and does not refuse it a second time", async () => {
    const { owner, device } = await setup();
    const stranger = await seedUser();
    const strangerBucket = await seedBucket(stranger);
    const theirs = await seedItem(stranger, strangerBucket, {
      deadline: new Date(T0.getTime() + HOUR),
    });
    const change = { seq: 1, type: "item.patch", id: theirs, patch: { title: "mine now" } };

    expect(applyPush(db, owner, device, [change], T0)).toEqual([
      { seq: 1, result: "rejected", reason: ITEM_GONE_ERROR },
    ]);
    expect(applyPush(db, owner, device, [change], T0)).toEqual([{ seq: 1, result: "duplicate" }]);
    expect(itemOf(theirs)?.title).toBe("pay rent");
    expect(lastSeqOf(owner, device)).toBe(1);
  });

  it("refuses an invalid or unknown change and still applies the ones after it", async () => {
    const { owner, bucketId, device } = await setup();
    const id = newItemId();

    const results = applyPush(
      db,
      owner,
      device,
      [
        { seq: 1, type: "item.create", id: "not-a-uuid", bucketId, title: "x", deadline: null },
        { seq: 2, type: "item.teleport" },
        { seq: 3, type: "item.create", id, bucketId, title: "ok", deadline: null },
      ],
      T0
    );

    expect(results.map((r) => r.result)).toEqual(["rejected", "rejected", "applied"]);
    expect(itemOf(id)?.title).toBe("ok");
  });

  it("refuses what the rules refuse", async () => {
    const { owner, bucketId, device } = await setup();
    const stranger = await seedUser();
    const id = newItemId();

    const results = applyPush(
      db,
      owner,
      device,
      [
        { seq: 1, type: "item.create", id, bucketId, title: "  ", deadline: null },
        { seq: 2, type: "item.create", id, bucketId: 999999, title: "x", deadline: null },
        {
          seq: 3,
          type: "item.create",
          id,
          bucketId,
          title: "x",
          deadline: null,
          assigneeIds: [stranger],
        },
      ],
      T0
    );

    expect(results.map((r) => r.result)).toEqual(["rejected", "rejected", "rejected"]);
    expect(itemOf(id)).toBeUndefined();
  });

  it("does not let a create take over an id that exists", async () => {
    const { owner, bucketId, device } = await setup();
    const stranger = await seedUser();
    const strangerBucket = await seedBucket(stranger);
    const theirs = await seedItem(stranger, strangerBucket, {
      deadline: new Date(T0.getTime() + HOUR),
    });
    const before = itemOf(theirs);

    const results = applyPush(
      db,
      owner,
      device,
      [{ seq: 1, type: "item.create", id: theirs, bucketId, title: "mine", deadline: null }],
      T0
    );

    expect(results).toEqual([{ seq: 1, result: "rejected", reason: "That item already exists" }]);
    expect(itemOf(theirs)).toEqual(before);
  });

  it("keeps each device's, and each person's, sequence apart", async () => {
    const { owner, friend, bucketId, device } = await setup();
    const other = crypto.randomUUID();
    const create = (id: string) => ({
      seq: 1,
      type: "item.create",
      id,
      bucketId,
      title: "x",
      deadline: null,
    });

    const results = [
      applyPush(db, owner, device, [create(newItemId())], T0),
      applyPush(db, owner, other, [create(newItemId())], T0),
      applyPush(db, friend, device, [create(newItemId())], T0),
    ].flat();

    expect(results.map((r) => r.result)).toEqual(["applied", "applied", "applied"]);
  });

  it("leaves a change that crashed halfway undone, with its sequence, so a retry applies it", async () => {
    const { owner, bucketId, device } = await setup();
    const [a, b] = [newItemId(), newItemId()];
    const batch = [
      { seq: 1, type: "item.create", id: a, bucketId, title: "a", deadline: "2026-03-20" },
      { seq: 2, type: "item.create", id: b, bucketId, title: "b", deadline: "2026-03-20" },
    ];
    db.run(
      `CREATE TRIGGER fail_second BEFORE INSERT ON items WHEN NEW.title = 'b' BEGIN SELECT RAISE(ABORT, 'write failed'); END`
    );
    try {
      expect(() => applyPush(db, owner, device, batch, T0)).toThrow();
    } finally {
      db.run(`DROP TRIGGER fail_second`);
    }
    expect(itemOf(a)?.title).toBe("a");
    expect(itemOf(b)).toBeUndefined();
    expect(lastSeqOf(owner, device)).toBe(1);

    expect(applyPush(db, owner, device, batch, T0)).toEqual([
      { seq: 1, result: "duplicate" },
      { seq: 2, result: "applied" },
    ]);
  });

  it("undoes the change when saving the sequence fails", async () => {
    const { owner, bucketId, device } = await setup();
    const id = newItemId();
    db.run(
      `CREATE TRIGGER fail_seq BEFORE INSERT ON sync_devices BEGIN SELECT RAISE(ABORT, 'write failed'); END`
    );
    try {
      expect(() =>
        applyPush(
          db,
          owner,
          device,
          [{ seq: 1, type: "item.create", id, bucketId, title: "a", deadline: null }],
          T0
        )
      ).toThrow();
    } finally {
      db.run(`DROP TRIGGER fail_seq`);
    }
    expect(itemOf(id)).toBeUndefined();
  });
});

describe("sync_devices", () => {
  it("goes with the account", async () => {
    const { owner, bucketId, device } = await setup();
    applyPush(
      db,
      owner,
      device,
      [{ seq: 1, type: "item.create", id: newItemId(), bucketId, title: "a", deadline: null }],
      T0
    );
    expect(lastSeqOf(owner, device)).toBe(1);

    db.delete(users).where(eq(users.id, owner)).run();

    expect(lastSeqOf(owner, device)).toBeUndefined();
  });
});

describe("POST /api/v1/sync/push", () => {
  const post = (body: unknown, version: string | null = String(SYNC_PROTOCOL_VERSION)) =>
    POST(
      new Request("http://localhost/api/v1/sync/push", {
        method: "POST",
        headers: version === null ? {} : { [SYNC_PROTOCOL_HEADER]: version },
        body: typeof body === "string" ? body : JSON.stringify(body),
      })
    );

  it("answers 401 without a session", async () => {
    session.signedIn = false;
    expect((await post({ deviceId: crypto.randomUUID(), mutations: [] })).status).toBe(401);
  });

  it("answers 400 to a body that isn't the protocol, and changes nothing", async () => {
    const { owner } = await setup();
    session.userId = owner;
    const device = crypto.randomUUID();
    const one = { seq: 1, type: "item.delete", id: newItemId() };

    const bad = [
      "{not json",
      { mutations: [] },
      { deviceId: "nope", mutations: [] },
      { deviceId: device, mutations: [{ type: "item.delete" }] },
      { deviceId: device, mutations: [{ ...one, seq: 0 }] },
      {
        deviceId: device,
        mutations: [
          { ...one, seq: 2 },
          { ...one, seq: 2 },
        ],
      },
      {
        deviceId: device,
        mutations: [
          { ...one, seq: 3 },
          { ...one, seq: 2 },
        ],
      },
      {
        deviceId: device,
        mutations: Array.from({ length: PUSH_MAX_MUTATIONS + 1 }, (_, i) => ({
          ...one,
          seq: i + 1,
        })),
      },
    ];
    for (const body of bad) expect((await post(body)).status).toBe(400);
    expect(lastSeqOf(owner, device)).toBeUndefined();
  });

  it("wants the protocol version, and answers 426 to one that is no longer served", async () => {
    const { owner, bucketId } = await setup();
    session.userId = owner;
    const id = newItemId();
    const body = {
      deviceId: crypto.randomUUID(),
      mutations: [{ seq: 1, type: "item.create", id, bucketId, title: "a", deadline: null }],
    };

    expect((await post(body, null)).status).toBe(400);
    expect((await post(body, "soon")).status).toBe(400);
    const old = await post(body, "0");
    expect(old.status).toBe(426);
    expect(await old.json()).toMatchObject({ minProtocol: 1 });
    expect(itemOf(id)).toBeUndefined();
  });

  it("answers 413 to a body that is too large", async () => {
    const { owner } = await setup();
    session.userId = owner;
    expect((await post("x".repeat(1_000_001))).status).toBe(413);
  });

  it("applies the changes for the signed-in person and returns each result", async () => {
    const { owner, bucketId } = await setup();
    session.userId = owner;
    const device = crypto.randomUUID();
    const id = newItemId();
    const body = {
      deviceId: device,
      mutations: [{ seq: 1, type: "item.create", id, bucketId, title: "a", deadline: null }],
    };

    const response = await post(body);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ results: [{ seq: 1, result: "applied" }] });
    expect(itemOf(id)?.userId).toBe(owner);

    expect(await (await post(body)).json()).toEqual({
      results: [{ seq: 1, result: "duplicate" }],
    });
  });
});

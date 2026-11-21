import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bucketMembers, items, syncState } from "@/lib/db/schema";
import { ITEM_GONE_ERROR, ITEM_STATUS, NOT_A_MEMBER_ERROR } from "@/constants";
import { deleteItemForever } from "@/lib/items/trash";
import type { RawMutation } from "@/lib/sync/protocol";
import { applyPush } from "@/lib/sync/push";
import { Device, visible } from "./sync-device";
import {
  resetSchedulerEnvironment,
  seedBucket,
  seedMember,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

// Several devices make random edits, online and offline, with sends that fail halfway, answers that
// never arrive and people being added to and removed from buckets. When every device has synced they
// must all hold exactly what the server shows, and the server must hold what applying every change
// in the order it was received gives. A failing seed reproduces the run: SYNC_SIM_SEED=<n>
const T0 = new Date("2026-03-10T12:00:00Z");
const STEPS = 160;
const SEEDS = process.env.SYNC_SIM_SEED
  ? [Number(process.env.SYNC_SIM_SEED)]
  : Array.from({ length: Number(process.env.SYNC_SIM_RUNS ?? 20) }, (_, i) => i + 1);

beforeEach(() => useSchedulerEnvironment(T0));
afterEach(() => resetSchedulerEnvironment());

function random(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Model = {
  bucketId: number;
  title: string;
  description: string | null;
  status: string;
  assignees: number[] | null;
  state: "live" | "trashed" | "gone";
};

type Sim = {
  seed: number;
  next: () => number;
  uuid: () => string;
  owner: number;
  members: number[];
  buckets: number[];
  devices: SimDevice[];
  model: Map<string, Model>;
  outcomes: Map<string, string>;
  enqueued: Set<string>;
  rejections: string[];
  counter: number;
};

type SimDevice = {
  userId: number;
  deviceId: string;
  view: Device;
  queue: RawMutation[];
  seq: number;
};

const ALLOWED_REJECTIONS = [ITEM_GONE_ERROR, NOT_A_MEMBER_ERROR, "Bucket not found"];

function pick<T>(sim: Sim, list: T[]): T | undefined {
  return list[Math.floor(sim.next() * list.length)];
}
const chance = (sim: Sim, p: number) => sim.next() < p;

function newUuid(next: () => number): string {
  const hex = () => Math.floor(next() * 16).toString(16);
  const part = (n: number) => Array.from({ length: n }, hex).join("");
  return `${part(8)}-${part(4)}-4${part(3)}-8${part(3)}-${part(12)}`;
}

function enqueue(sim: Sim, device: SimDevice, mutation: { type: string; [key: string]: unknown }) {
  const seq = ++device.seq;
  device.queue.push({ ...mutation, seq });
  sim.enqueued.add(`${device.deviceId}:${seq}`);
}

function knownItems(device: Device) {
  return [...device.rows.values()].flatMap((r) =>
    r.entity === "item" && r.data.deletedAt === null ? [r.data] : []
  );
}

function knownBuckets(device: Device) {
  return [...device.rows.values()].flatMap((r) =>
    r.entity === "bucket" && r.data.deletedAt === null ? [r.data.id] : []
  );
}

function knownMembers(device: Device, bucketId: number) {
  return [...device.rows.values()].flatMap((r) =>
    r.entity === "bucket_member" && r.data.bucketId === bucketId ? [r.data.userId] : []
  );
}

let titleCounter = 0;
const text = (prefix: string) => `${prefix}${++titleCounter}`;

function deadline(sim: Sim): string | null {
  return chance(sim, 0.4)
    ? null
    : `2026-04-${String(1 + Math.floor(sim.next() * 27)).padStart(2, "0")}`;
}

function create(sim: Sim, device: SimDevice) {
  const bucketId = pick(sim, knownBuckets(device.view));
  if (bucketId === undefined) return;
  const people = knownMembers(device.view, bucketId);
  const assigneeIds = chance(sim, 0.5) ? people.filter(() => chance(sim, 0.6)) : undefined;
  enqueue(sim, device, {
    type: "item.create",
    id: sim.uuid(),
    bucketId,
    title: text("item "),
    deadline: deadline(sim),
    ...(assigneeIds && { assigneeIds }),
  });
}

function patch(sim: Sim, device: SimDevice) {
  const item = pick(sim, knownItems(device.view));
  if (!item) return;
  const fields: Record<string, unknown> = {};
  if (chance(sim, 0.5)) fields.title = text("title ");
  if (chance(sim, 0.3)) fields.description = chance(sim, 0.3) ? null : text("notes ");
  if (chance(sim, 0.3)) {
    fields.status = chance(sim, 0.5) ? ITEM_STATUS.completed : ITEM_STATUS.active;
  }
  if (chance(sim, 0.3)) {
    fields.assigneeIds = knownMembers(device.view, item.bucketId).filter(() => chance(sim, 0.6));
  }
  if (chance(sim, 0.3)) fields.deadline = deadline(sim);
  if (Object.keys(fields).length === 0) fields.title = text("title ");
  enqueue(sim, device, { type: "item.patch", id: item.id, patch: fields });
}

function remove(sim: Sim, device: SimDevice) {
  const item = pick(sim, knownItems(device.view));
  if (item) enqueue(sim, device, { type: "item.delete", id: item.id });
}

// The server receives one change at a time, which is what a push does, so the model is told in the
// order the server applied them
function serve(sim: Sim, device: SimDevice, mutation: RawMutation) {
  const [result] = applyPush(db, device.userId, device.deviceId, [mutation], T0);
  const key = `${device.deviceId}:${mutation.seq}`;
  if (result.result === "duplicate") return;
  expect(sim.outcomes.has(key), `seed ${sim.seed}: ${key} was handled twice`).toBe(false);
  sim.outcomes.set(key, result.result);
  if (result.result === "rejected") {
    sim.rejections.push(result.reason);
    return;
  }
  const m = mutation as Record<string, unknown>;
  const id = m.id as string;
  if (mutation.type === "item.create") {
    sim.model.set(id, {
      bucketId: m.bucketId as number,
      title: m.title as string,
      description: null,
      status: ITEM_STATUS.active,
      assignees: (m.assigneeIds as number[] | undefined) ?? null,
      state: "live",
    });
  } else if (mutation.type === "item.patch") {
    const model = sim.model.get(id);
    const fields = m.patch as Record<string, unknown>;
    if (!model) throw new Error(`seed ${sim.seed}: a patch applied to an item the model never saw`);
    if ("title" in fields) model.title = fields.title as string;
    if ("description" in fields) model.description = fields.description as string | null;
    if ("status" in fields) model.status = fields.status as string;
    if ("assigneeIds" in fields) model.assignees = fields.assigneeIds as number[];
  } else {
    const model = sim.model.get(id);
    if (model) model.state = "trashed";
  }
}

type SendOptions = { take?: number; lostAnswer?: boolean; crash?: boolean };

function push(sim: Sim, device: SimDevice, { take, lostAnswer, crash }: SendOptions = {}) {
  const batch = device.queue.slice(0, take ?? device.queue.length);
  if (batch.length === 0) return;
  const failAt = crash ? pick(sim, batch) : undefined;
  if (failAt) {
    db.run(
      `CREATE TRIGGER sim_crash BEFORE INSERT ON sync_devices WHEN NEW.device_id = '${device.deviceId}' AND NEW.last_seq = ${failAt.seq} BEGIN SELECT RAISE(ABORT, 'crash'); END`
    );
  }
  let answered = true;
  try {
    for (const mutation of batch) serve(sim, device, mutation);
  } catch (error) {
    if (!failAt) throw error;
    answered = false;
  } finally {
    if (failAt) db.run("DROP TRIGGER sim_crash");
  }
  if (answered && !lostAnswer) device.queue.splice(0, batch.length);
}

function pull(sim: Sim, device: SimDevice) {
  device.view.sync(1 + Math.floor(sim.next() * 12));
}

function membership(sim: Sim, bucketId: number, userId: number) {
  return db
    .select()
    .from(bucketMembers)
    .where(and(eq(bucketMembers.bucketId, bucketId), eq(bucketMembers.userId, userId)))
    .get();
}

async function serverEvent(sim: Sim) {
  const bucketId = pick(sim, sim.buckets);
  const person = pick(sim, sim.members);
  if (bucketId === undefined || person === undefined) return;
  const roll = sim.next();
  if (roll < 0.35) {
    if (membership(sim, bucketId, person)) {
      db.delete(bucketMembers)
        .where(and(eq(bucketMembers.bucketId, bucketId), eq(bucketMembers.userId, person)))
        .run();
    } else await seedMember(bucketId, person);
  } else if (roll < 0.7) {
    const trashed = [...sim.model].filter(([, m]) => m.state === "trashed");
    const chosen = pick(sim, trashed);
    if (chosen) {
      expect(await deleteItemForever(sim.owner, chosen[0])).toBe("deleted");
      chosen[1].state = "gone";
    }
  } else {
    const live = [...sim.model].filter(([, m]) => m.state === "live" && m.bucketId !== bucketId);
    const chosen = pick(sim, live);
    if (chosen) {
      db.update(items).set({ bucketId }).where(eq(items.id, chosen[0])).run();
      chosen[1].bucketId = bucketId;
    }
  }
}

async function run(seed: number): Promise<Sim> {
  const next = random(seed);
  const owner = await seedUser();
  const members = [await seedUser(), await seedUser()];
  const buckets = [await seedBucket(owner), await seedBucket(owner)];
  for (const bucketId of buckets) for (const person of members) await seedMember(bucketId, person);
  const sim: Sim = {
    seed,
    next,
    uuid: () => newUuid(next),
    owner,
    members,
    buckets,
    devices: [],
    model: new Map(),
    outcomes: new Map(),
    enqueued: new Set(),
    rejections: [],
    counter: 0,
  };
  for (const userId of [owner, owner, ...members]) {
    sim.devices.push({
      userId,
      deviceId: sim.uuid(),
      view: new Device(userId),
      queue: [],
      seq: 0,
    });
  }

  const steps: [number, (device: SimDevice) => void | Promise<void>][] = [
    [22, (d) => create(sim, d)],
    [30, (d) => patch(sim, d)],
    [8, (d) => remove(sim, d)],
    [14, (d) => (push(sim, d), pull(sim, d))],
    [8, (d) => push(sim, d, { take: 1 + Math.floor(sim.next() * 3) })],
    [5, (d) => push(sim, d, { lostAnswer: true })],
    [5, (d) => push(sim, d, { crash: true })],
    [10, (d) => pull(sim, d)],
    [6, () => serverEvent(sim)],
  ];
  const total = steps.reduce((sum, [weight]) => sum + weight, 0);
  for (let i = 0; i < STEPS; i++) {
    let roll = sim.next() * total;
    const [, action] = steps.find(([weight]) => (roll -= weight) < 0) ?? steps[0];
    const device = pick(sim, sim.devices);
    if (device) await action(device);
  }

  for (let round = 0; round < 12; round++) {
    for (const device of sim.devices) {
      push(sim, device);
      pull(sim, device);
    }
    const counter = db.select().from(syncState).get()?.rev;
    if (sim.devices.every((d) => d.queue.length === 0 && d.view.cursor === counter)) break;
  }
  return sim;
}

describe("devices that edit offline and online all converge", () => {
  it.each(SEEDS)("seed %i", { timeout: 60_000 }, async (seed) => {
    const sim = await run(seed);
    const at = `seed ${seed}`;

    for (const device of sim.devices) expect(device.queue, `${at}: unsent changes`).toEqual([]);

    expect(new Set(sim.outcomes.keys()), `${at}: every change has exactly one outcome`).toEqual(
      sim.enqueued
    );
    for (const reason of sim.rejections) expect(ALLOWED_REJECTIONS, at).toContain(reason);

    for (const device of sim.devices) {
      expect(device.view.keys(), `${at}: a device differs from the server`).toEqual(
        visible(device.userId)
      );
    }

    for (const [id, model] of sim.model) {
      const row = db.select().from(items).where(eq(items.id, id)).get();
      if (model.state === "gone") {
        expect(row, `${at}: ${id} should be gone`).toBeUndefined();
        continue;
      }
      expect(row, `${at}: ${id} is missing`).toBeDefined();
      expect(
        {
          bucketId: row?.bucketId,
          title: row?.title,
          description: row?.description,
          status: row?.status,
          trashed: row?.deletedAt !== null,
        },
        `${at}: ${id}`
      ).toEqual({
        bucketId: model.bucketId,
        title: model.title,
        description: model.description,
        status: model.status,
        trashed: model.state === "trashed",
      });
    }
  });

  it("has made real work of every kind in the seeds it runs", async () => {
    const outcomes = { applied: 0, rejected: 0 };
    let duplicates = 0;
    for (const seed of SEEDS.slice(0, 5)) {
      const sim = await run(seed);
      for (const result of sim.outcomes.values()) outcomes[result as "applied" | "rejected"]++;
      duplicates += sim.devices.length;
    }
    expect(outcomes.applied).toBeGreaterThan(50);
    expect(outcomes.rejected).toBeGreaterThan(0);
    expect(duplicates).toBeGreaterThan(0);
  });
});

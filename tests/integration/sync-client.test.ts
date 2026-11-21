import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import type * as SessionModule from "@/lib/auth/session";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { SYNC_PROTOCOL_HEADER, SYNC_PROTOCOL_VERSION } from "@/constants";
import { newItemId } from "@/lib/items/item-id";
import { GET as pullRoute } from "@/app/api/v1/sync/pull/route";
import { POST as pushRoute } from "@/app/api/v1/sync/push/route";
import { syncOnce, type Transport } from "@/lib/sync/client/engine";
import { enqueue, readQueue } from "@/lib/sync/client/queue";
import { readRecords } from "@/lib/sync/client/store";
import {
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
  globalThis.indexedDB = new IDBFactory();
});
afterEach(() => resetSchedulerEnvironment());

// The browser's calls, answered by the real route handlers
const transport: Transport = async (path, init) => {
  const request = new Request(`http://localhost${path}`, {
    ...init,
    headers: { ...init?.headers, [SYNC_PROTOCOL_HEADER]: String(SYNC_PROTOCOL_VERSION) },
  });
  return path.startsWith("/api/v1/sync/push") ? pushRoute(request) : pullRoute(request);
};

const localItems = async () =>
  (await readRecords()).flatMap((r) => (r.entity === "item" ? [r] : []));

describe("the client engine against the real endpoints", () => {
  it("downloads what the person can see and nothing else", async () => {
    const me = await seedUser();
    const other = await seedUser();
    const mine = await seedBucket(me);
    const theirs = await seedBucket(other);
    const id = await seedItem(me, mine, { deadline: new Date(T0.getTime() + 3_600_000) });
    await seedItem(other, theirs, { deadline: new Date(T0.getTime() + 3_600_000) });
    session.userId = me;

    expect((await syncOnce(transport, me)).status).toBe("ok");

    expect((await localItems()).map((r) => r.id)).toEqual([id]);
    const keys = (await readRecords()).map((r) => r.key);
    expect(keys).toContain(`bucket:${mine}`);
    expect(keys).not.toContain(`bucket:${theirs}`);
  });

  it("sends an offline create, edit and delete, and ends equal to the server", async () => {
    const me = await seedUser();
    const bucketId = await seedBucket(me);
    session.userId = me;
    await syncOnce(transport, me);

    const kept = newItemId();
    const gone = newItemId();
    await enqueue({ type: "item.create", id: kept, bucketId, title: "pay rent", deadline: null });
    await enqueue({ type: "item.create", id: gone, bucketId, title: "never mind", deadline: null });
    await enqueue({ type: "item.patch", id: kept, patch: { title: "pay the rent" } });

    expect(await syncOnce(transport, me)).toEqual({ status: "ok", rejected: [] });

    expect(await readQueue()).toEqual([]);
    expect(db.select().from(items).where(eq(items.id, kept)).get()?.title).toBe("pay the rent");
    expect((await localItems()).map((r) => r.id)).toEqual([kept, gone].sort());

    await enqueue({ type: "item.delete", id: gone });
    await syncOnce(transport, me);
    // Trash is not a delete: the row stays, marked, on the server and on the device
    expect(db.select().from(items).where(eq(items.id, gone)).get()?.deletedAt).not.toBeNull();
    const local = await localItems();
    expect(local.find((r) => r.id === gone)?.data.deletedAt).not.toBeNull();
    expect(local.find((r) => r.id === kept)?.data.deletedAt).toBeNull();
  });

  it("a create followed by a delete before sending never reaches the server", async () => {
    const me = await seedUser();
    const bucketId = await seedBucket(me);
    session.userId = me;
    const id = newItemId();
    await enqueue({ type: "item.create", id, bucketId, title: "x", deadline: null });
    await enqueue({ type: "item.delete", id });
    await syncOnce(transport, me);
    expect(db.select().from(items).where(eq(items.id, id)).get()).toBeUndefined();
    expect(await readQueue()).toEqual([]);
  });

  it("a change the server refuses is dropped with its reason, the rest still goes", async () => {
    const me = await seedUser();
    const stranger = await seedUser();
    const bucketId = await seedBucket(me);
    const notMine = await seedBucket(stranger);
    session.userId = me;
    const refused = newItemId();
    const fine = newItemId();
    await enqueue({
      type: "item.create",
      id: refused,
      bucketId: notMine,
      title: "a",
      deadline: null,
    });
    await enqueue({ type: "item.create", id: fine, bucketId, title: "b", deadline: null });

    const outcome = await syncOnce(transport, me);

    expect(outcome.status).toBe("ok");
    expect(outcome.rejected).toHaveLength(1);
    expect(outcome.rejected[0].mutation).toMatchObject({ id: refused });
    expect(outcome.rejected[0].reason).not.toBe("");
    expect((await localItems()).map((r) => r.id)).toEqual([fine]);
  });

  it("another device's changes arrive, a removed member loses the bucket", async () => {
    const owner = await seedUser();
    const friend = await seedUser();
    const bucketId = await seedBucket(owner);
    await seedMember(bucketId, friend);
    const id = await seedItem(owner, bucketId, { deadline: new Date(T0.getTime() + 3_600_000) });
    session.userId = friend;
    await syncOnce(transport, friend);
    expect((await localItems()).map((r) => r.id)).toEqual([id]);

    const { bucketMembers } = await import("@/lib/db/schema");
    const { and } = await import("drizzle-orm");
    db.delete(bucketMembers)
      .where(and(eq(bucketMembers.bucketId, bucketId), eq(bucketMembers.userId, friend)))
      .run();
    await syncOnce(transport, friend);

    expect(await readRecords()).toEqual([]);
  });

  it("a signed-out person keeps the queue", async () => {
    const me = await seedUser();
    const bucketId = await seedBucket(me);
    session.userId = me;
    await enqueue({ type: "item.create", id: newItemId(), bucketId, title: "x", deadline: null });
    session.signedIn = false;
    expect((await syncOnce(transport, me)).status).toBe("signedOut");
    expect(await readQueue()).toHaveLength(1);
  });
});

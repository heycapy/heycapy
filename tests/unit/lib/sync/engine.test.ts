import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SYNC_PROTOCOL_HEADER } from "@/constants";
import { META_CURSOR, META_DEVICE_ID, META_SCHEMA } from "@/lib/sync/client/constants";
import { browserTransport, syncOnce, type Transport } from "@/lib/sync/client/engine";
import { enqueue, readQueue } from "@/lib/sync/client/queue";
import { takeRejections } from "@/lib/sync/client/rejections";
import { applyPullPage, readMeta, readRecords } from "@/lib/sync/client/store";
import type { NewMutation, PullPage, WireRecord } from "@/lib/sync/client/types";

const ME = 1;
const A = "00000000-0000-7000-8000-00000000000a";
const B = "00000000-0000-7000-8000-00000000000b";

const json = (body: unknown, status = 200) => Response.json(body, { status });
const empty = (cursor = 0, schema = 1) => ({
  reset: false,
  cursor,
  more: false,
  schema,
  protocol: 1,
  records: [],
  tombstones: [],
});
const bucket: WireRecord = {
  entity: "bucket",
  id: 1,
  rev: 1,
  data: { id: 1, name: "home" } as Extract<WireRecord, { entity: "bucket" }>["data"],
};
const create = (id: string): NewMutation => ({
  type: "item.create",
  id,
  bucketId: 1,
  title: id,
  deadline: null,
});

type Call = { path: string; body: { deviceId: string; mutations: { seq: number }[] } | null };
function scripted(answers: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const transport: Transport = async (path, init) => {
    const call = { path, body: init?.body ? JSON.parse(String(init.body)) : null };
    calls.push(call);
    return answers(call);
  };
  return { transport, calls };
}
const applied = (call: Call) =>
  json({ results: call.body?.mutations.map((m) => ({ seq: m.seq, result: "applied" })) });

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe("syncOnce", () => {
  it("sends the queue in order with one device id, then pulls", async () => {
    await enqueue(create(A));
    await enqueue(create(B));
    const { transport, calls } = scripted((c) => (c.body ? applied(c) : json(empty(7))));

    expect(await syncOnce(transport, ME)).toEqual({ status: "ok", rejected: [] });

    expect(calls.map((c) => c.path)).toEqual([
      "/api/v1/sync/push",
      "/api/v1/sync/pull?cursor=0&limit=500",
    ]);
    expect(calls[0].body?.mutations.map((m) => m.seq)).toEqual([1, 2]);
    expect(await readQueue()).toEqual([]);
    expect(await readMeta(META_CURSOR)).toBe(7);
    expect(await readMeta(META_DEVICE_ID)).toBe(calls[0].body?.deviceId);
  });

  it("uses the same device id on every round", async () => {
    await enqueue(create(A));
    const { transport, calls } = scripted((c) => (c.body ? applied(c) : json(empty())));
    await syncOnce(transport, ME);
    await enqueue(create(B));
    await syncOnce(transport, ME);
    const ids = calls.flatMap((c) => (c.body ? [c.body.deviceId] : []));
    expect(new Set(ids).size).toBe(1);
  });

  it("drops a rejected change and says why, and keeps going", async () => {
    await enqueue(create(A));
    await enqueue(create(B));
    const { transport } = scripted((c) =>
      c.body
        ? json({
            results: [
              { seq: 1, result: "rejected", reason: "no longer a member" },
              { seq: 2, result: "duplicate" },
            ],
          })
        : json(empty())
    );
    const outcome = await syncOnce(transport, ME);
    expect(outcome).toEqual({
      status: "ok",
      rejected: [{ mutation: create(A), reason: "no longer a member" }],
    });
    expect(await readQueue()).toEqual([]);
    expect(await takeRejections()).toMatchObject([{ title: A, reason: "no longer a member" }]);
  });

  it("keeps a change whose answer never arrived, and sends the same seq again", async () => {
    await enqueue(create(A));
    const lost = scripted(() => Promise.reject(new TypeError("offline")));
    expect((await syncOnce(lost.transport, ME)).status).toBe("retry");
    expect((await readQueue()).map((e) => [e.seq, e.sent])).toEqual([[1, true]]);

    await enqueue({ type: "item.patch", id: A, patch: { title: "edited" } });
    const back = scripted((c) => (c.body ? applied(c) : json(empty())));
    expect((await syncOnce(back.transport, ME)).status).toBe("ok");
    const sent = back.calls[0].body?.mutations as { seq: number; type: string; title?: string }[];
    expect(sent.map((m) => [m.seq, m.type])).toEqual([
      [1, "item.create"],
      [2, "item.patch"],
    ]);
    expect(sent[0].title).toBe(A);
  });

  it("retries on a server error and keeps the queue", async () => {
    await enqueue(create(A));
    const { transport } = scripted(() => json({ error: "boom" }, 500));
    expect((await syncOnce(transport, ME)).status).toBe("retry");
    expect(await readQueue()).toHaveLength(1);
  });

  it("stops on 426 without pulling", async () => {
    const { transport, calls } = scripted(() => json({ minProtocol: 2 }, 426));
    expect((await syncOnce(transport, ME)).status).toBe("upgrade");
    expect(calls).toHaveLength(1);
  });

  it("treats a redirect to the login page as signed out", async () => {
    const redirect = new Response(null);
    Object.defineProperty(redirect, "type", { value: "opaqueredirect" });
    const { transport } = scripted(() => redirect);
    expect((await syncOnce(transport, ME)).status).toBe("signedOut");
  });

  it("follows pages until there are no more", async () => {
    const { transport, calls } = scripted((c) =>
      c.path.includes("cursor=0")
        ? json({ ...empty(4), more: true, records: [bucket] })
        : json(empty(9))
    );
    await syncOnce(transport, ME);
    expect(calls.map((c) => c.path)).toEqual([
      "/api/v1/sync/pull?cursor=0&limit=500",
      "/api/v1/sync/pull?cursor=4&limit=500",
    ]);
    expect((await readRecords()).map((r) => r.key)).toEqual(["bucket:1"]);
    expect(await readMeta(META_CURSOR)).toBe(9);
  });

  it("downloads again from 0 on a reset", async () => {
    const seed: PullPage = {
      reset: false,
      cursor: 50,
      more: false,
      records: [bucket],
      tombstones: [],
    };
    await applyPullPage(seed, ME, 1);
    await enqueue(create(A));
    const run = scripted((c) => {
      if (c.body) return applied(c);
      return c.path.includes("cursor=50") ? json({ reset: true }) : json(empty(3));
    });
    expect((await syncOnce(run.transport, ME)).status).toBe("ok");
    expect(run.calls.map((c) => c.path).slice(1)).toEqual([
      "/api/v1/sync/pull?cursor=50&limit=500",
      "/api/v1/sync/pull?cursor=0&limit=500",
    ]);
    expect(await readRecords()).toEqual([]);
    expect(await readMeta(META_CURSOR)).toBe(3);
  });

  it("drops the cache but never the queue when the schema changes", async () => {
    await applyPullPage(
      { reset: false, cursor: 5, more: false, records: [bucket], tombstones: [] },
      ME,
      1
    );
    await enqueue(create(A));
    await (async () => {
      const hold = scripted(() => Promise.reject(new TypeError("offline")));
      await syncOnce(hold.transport, ME);
    })();
    const { transport, calls } = scripted((c) => {
      if (c.body) return applied(c);
      return c.path.includes("cursor=5")
        ? json(empty(8, 2))
        : json({ ...empty(8, 2), records: [] });
    });
    expect((await syncOnce(transport, ME)).status).toBe("ok");
    expect(calls.map((c) => c.path).filter((p) => p.includes("pull"))).toEqual([
      "/api/v1/sync/pull?cursor=5&limit=500",
      "/api/v1/sync/pull?cursor=0&limit=500",
    ]);
    expect(await readRecords()).toEqual([]);
    expect(await readMeta(META_SCHEMA)).toBe(2);
  });

  it("starts from nothing when another person signs in on this browser", async () => {
    await applyPullPage(
      { reset: false, cursor: 5, more: false, records: [bucket], tombstones: [] },
      ME,
      1
    );
    await enqueue(create(A));
    const { transport, calls } = scripted(() => json(empty(2)));
    await syncOnce(transport, 2);
    expect(calls.map((c) => c.path)).toEqual(["/api/v1/sync/pull?cursor=0&limit=500"]);
    expect(await readQueue()).toEqual([]);
    expect(await readRecords()).toEqual([]);
  });

  it("splits a long queue into batches of at most 100", async () => {
    for (let i = 0; i < 120; i++) {
      await enqueue(create(`00000000-0000-7000-8000-${String(i).padStart(12, "0")}`));
    }
    const { transport, calls } = scripted((c) => (c.body ? applied(c) : json(empty())));
    await syncOnce(transport, ME);
    const sizes = calls.flatMap((c) => (c.body ? [c.body.mutations.length] : []));
    expect(sizes).toEqual([100, 20]);
  });
});

describe("browserTransport", () => {
  it("sends the protocol version and does not follow redirects", async () => {
    const fetchMock = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    await browserTransport("/api/v1/sync/pull");
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.redirect).toBe("manual");
    expect((init.headers as Record<string, string>)[SYNC_PROTOCOL_HEADER]).toBe("1");
    vi.unstubAllGlobals();
  });
});

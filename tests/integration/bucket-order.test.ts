import { describe, expect, it, vi } from "vitest";
import type * as SessionModule from "@/lib/auth/session";
import { reorderBucketsAction } from "@/app/(app)/bucket-actions";
import { listLiveBuckets } from "@/lib/buckets/access";
import { BUCKET_ORDER_MAX } from "@/constants";
import { seedBucket, seedMember, seedUser } from "./helpers";

const session = vi.hoisted(() => ({ userId: 0, email: "" }));
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof SessionModule>()),
  getSession: async () => session,
}));

const order = async (userId: number) => (await listLiveBuckets(userId)).map((b) => b.id);

describe("each person's own tab order", () => {
  it("keeps the order a person drags their tabs into", async () => {
    const me = await seedUser();
    const [a, b, c] = [await seedBucket(me), await seedBucket(me), await seedBucket(me)];
    session.userId = me;

    const colors = async () =>
      Object.fromEntries((await listLiveBuckets(me)).map((x) => [x.id, x.colorIndex]));
    expect(await colors()).toEqual({ [a]: 0, [b]: 1, [c]: 2 });

    expect(await reorderBucketsAction([c, a, b])).toEqual({ ok: true });
    expect(await order(me)).toEqual([c, a, b]);
    expect(await colors()).toEqual({ [a]: 0, [b]: 1, [c]: 2 });
  });

  it("puts a bucket made or joined later after the ones already placed", async () => {
    const me = await seedUser();
    const friend = await seedUser();
    const [a, b] = [await seedBucket(me), await seedBucket(me)];
    session.userId = me;
    await reorderBucketsAction([b, a]);

    const made = await seedBucket(me);
    const joined = await seedBucket(friend);
    await seedMember(joined, me);
    expect(await order(me)).toEqual([b, a, made, joined]);
  });

  it("moves a shared bucket only for the person who moved it", async () => {
    const owner = await seedUser();
    const member = await seedUser();
    const [mine, shared] = [await seedBucket(owner), await seedBucket(owner)];
    const membersOwn = await seedBucket(member);
    await seedMember(shared, member);

    session.userId = member;
    await reorderBucketsAction([shared, membersOwn]);

    expect(await order(member)).toEqual([shared, membersOwn]);
    expect(await order(owner)).toEqual([mine, shared]);
  });

  it("leaves out a bucket the person isn't in", async () => {
    const me = await seedUser();
    const stranger = await seedUser();
    const [a, b] = [await seedBucket(me), await seedBucket(me)];
    const theirs = await seedBucket(stranger);
    const theirsToo = await seedBucket(stranger);
    session.userId = me;

    expect(await reorderBucketsAction([theirs, b, a])).toEqual({ ok: true });
    expect(await order(me)).toEqual([b, a]);
    session.userId = stranger;
    expect(await order(stranger)).toEqual([theirs, theirsToo]);
  });

  it("refuses a list that isn't bucket ids, or longer than anyone keeps", async () => {
    const me = await seedUser();
    const a = await seedBucket(me);
    session.userId = me;

    for (const bad of [[a, -1], [a, 1.5], ["1"], Array(BUCKET_ORDER_MAX + 1).fill(a)]) {
      expect(await reorderBucketsAction(bad as number[])).toMatchObject({ ok: false });
    }
  });
});

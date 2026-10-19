import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bucketMembers, buckets, users } from "@/lib/db/schema";
import { voiceContext } from "@/lib/transcription/hints";
import {
  HOUR,
  resetSchedulerEnvironment,
  seedBucket,
  seedItem,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

const NOW = new Date("2026-03-10T12:00:00Z");

beforeEach(() => useSchedulerEnvironment(NOW));
afterEach(() => resetSchedulerEnvironment());

async function sharedBucket() {
  const owner = await seedUser();
  const member = await seedUser();
  const stranger = await seedUser();
  const bucketId = await seedBucket(owner);
  await db.update(buckets).set({ name: "Home" }).where(eq(buckets.id, bucketId));
  await db
    .update(users)
    .set({ username: `quiet-otter-${owner}` })
    .where(eq(users.id, owner));
  await db
    .update(users)
    .set({ username: `sam_${member}` })
    .where(eq(users.id, member));
  await db.insert(bucketMembers).values({ bucketId, userId: member });
  await seedItem(owner, bucketId, {
    title: "book flights",
    deadline: new Date(NOW.getTime() + HOUR),
  });
  return { owner, member, stranger };
}

describe("voice hints", () => {
  it("gives a member the bucket they joined, everyone's items in it and the others' names", async () => {
    const { owner, member } = await sharedBucket();

    const forMember = (await voiceContext(member, "capy")).names;
    expect(forMember).toEqual(
      expect.arrayContaining(["Home", "book flights", `quiet-otter-${owner}`])
    );
    expect(forMember).not.toContain(`sam_${member}`);

    const forOwner = (await voiceContext(owner, "capy")).names;
    expect(forOwner).toEqual(expect.arrayContaining(["Home", "book flights", `sam_${member}`]));
    expect(forOwner).not.toContain(`quiet-otter-${owner}`);
  });

  it("gives someone outside the bucket none of it", async () => {
    const { stranger, owner, member } = await sharedBucket();

    const names = (await voiceContext(stranger, "capy")).names;
    expect(names).not.toContain("Home");
    expect(names).not.toContain("book flights");
    expect(names).not.toContain(`sam_${member}`);
    expect(names).not.toContain(`quiet-otter-${owner}`);
  });
});

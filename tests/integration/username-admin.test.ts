import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bucketMembers, users } from "@/lib/db/schema";
import {
  adjustUsernameBonusAction,
  getUserUsernameAction,
  renameUserAction,
} from "@/app/(app)/system-actions";
import { changeUsername } from "@/lib/account/username";
import { USERNAME_CHANGES_PER_WINDOW } from "@/lib/account/constants";
import { dataEvents } from "@/lib/events";
import { seedBucket, seedUser } from "./helpers";

const ADMIN = "admin@heycapy.test";

let session: { userId: number; email: string } | null = null;
vi.mock("@/lib/auth/session", () => ({ getSession: async () => session }));

afterEach(() => {
  session = null;
  vi.unstubAllEnvs();
});

let count = 0;
async function userNamed(prefix: string) {
  count += 1;
  const id = await seedUser();
  const name = `${prefix}_admin_${count}`;
  const [row] = await db
    .update(users)
    .set({ username: name })
    .where(eq(users.id, id))
    .returning({ email: users.email });
  return { id, name, email: row.email };
}

function asAdmin() {
  vi.stubEnv("ADMIN_EMAILS", ADMIN);
  session = { userId: 0, email: ADMIN };
}

describe("admin username box", () => {
  it("is only for admins", async () => {
    const sam = await userNamed("sam");
    vi.stubEnv("ADMIN_EMAILS", ADMIN);
    session = { userId: sam.id, email: sam.email };
    const refused = { ok: false, error: "Not allowed" };

    expect(await getUserUsernameAction(sam.email)).toEqual(refused);
    expect(await renameUserAction({ email: sam.email, username: "sam_free_name" })).toEqual(
      refused
    );
    expect(await adjustUsernameBonusAction({ email: sam.email, delta: 1 })).toEqual(refused);
    expect((await db.query.users.findFirst({ where: eq(users.id, sam.id) }))?.username).toBe(
      sam.name
    );
  });

  it("looks a person up by email, any case, with their allowance and changes newest first", async () => {
    asAdmin();
    const sam = await userNamed("sam");
    await changeUsername(sam.id, `${sam.name}_a`, { now: new Date("2026-10-01T00:00:00Z") });
    await changeUsername(sam.id, `${sam.name}_b`, { now: new Date("2026-10-02T00:00:00Z") });

    const result = await getUserUsernameAction(sam.email.toUpperCase());
    expect(result).toMatchObject({
      ok: true,
      user: { email: sam.email, username: `${sam.name}_b`, allowance: { bonus: 0 } },
    });
    expect(result.ok && result.user.changes.map((c) => c.newUsername)).toEqual([
      `${sam.name}_b`,
      `${sam.name}_a`,
    ]);
    expect(await getUserUsernameAction("nobody@heycapy.test")).toEqual({
      ok: false,
      error: "no user with that email",
    });
  });

  it("renames without using the person's changes, even when theirs are used up", async () => {
    asAdmin();
    const sam = await userNamed("sam");
    for (let i = 1; i <= USERNAME_CHANGES_PER_WINDOW; i++) {
      await changeUsername(sam.id, `${sam.name}_${i}`);
    }

    const result = await renameUserAction({ email: sam.email, username: `${sam.name}_fixed` });
    expect(result).toMatchObject({
      ok: true,
      user: {
        username: `${sam.name}_fixed`,
        allowance: { used: USERNAME_CHANGES_PER_WINDOW, bonus: 0 },
      },
    });
    expect(result.ok && result.user.changes[0]).toMatchObject({
      newUsername: `${sam.name}_fixed`,
      byAdmin: true,
    });
  });

  it("still keeps the rules and someone else's name", async () => {
    asAdmin();
    const sam = await userNamed("sam");
    const ana = await userNamed("ana");

    expect(await renameUserAction({ email: sam.email, username: ana.name })).toEqual({
      ok: false,
      error: "someone else has that username",
    });
    expect(await renameUserAction({ email: sam.email, username: "support" })).toEqual({
      ok: false,
      error: "that username is reserved",
    });
    expect(await renameUserAction({ email: sam.email, username: sam.name })).toEqual({
      ok: false,
      error: "that's already their username",
    });
  });

  it("gives and takes bonus changes one at a time, never below zero", async () => {
    asAdmin();
    const sam = await userNamed("sam");

    expect(await adjustUsernameBonusAction({ email: sam.email, delta: 1 })).toMatchObject({
      ok: true,
      user: { allowance: { bonus: 1 } },
    });
    expect(await adjustUsernameBonusAction({ email: sam.email, delta: -1 })).toMatchObject({
      ok: true,
      user: { allowance: { bonus: 0 } },
    });
    expect(await adjustUsernameBonusAction({ email: sam.email, delta: -1 })).toEqual({
      ok: false,
      error: "they have no bonus changes to take",
    });
    expect(await adjustUsernameBonusAction({ email: sam.email, delta: 5 })).toEqual({
      ok: false,
      error: "give or take one bonus change at a time",
    });
    expect(
      (await db.query.users.findFirst({ where: eq(users.id, sam.id) }))?.usernameBonusChanges
    ).toBe(0);
  });

  it("tells every bucket the person is in, so the others' screens show the new name", async () => {
    asAdmin();
    const sam = await userNamed("sam");
    const own = await seedBucket(sam.id);
    const shared = await seedBucket(await seedUser());
    await db.insert(bucketMembers).values({ bucketId: shared, userId: sam.id });
    const changed: number[] = [];
    const listener = (id: number) => changed.push(id);
    dataEvents.on("bucket", listener);

    try {
      await renameUserAction({ email: sam.email, username: `${sam.name}_told` });
    } finally {
      dataEvents.off("bucket", listener);
    }
    expect(changed.sort()).toEqual([own, shared].sort());
  });
});

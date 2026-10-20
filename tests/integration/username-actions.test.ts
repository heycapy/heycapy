import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import {
  changeUsernameAction,
  checkUsernameAction,
  getUsernameAction,
  suggestUsernameAction,
} from "@/app/(app)/username-actions";
import { changeUsername } from "@/lib/account/username";
import { USERNAME_CHANGES_PER_WINDOW } from "@/lib/account/constants";
import { seedUser } from "./helpers";

let session: { userId: number; email?: string } | null = null;
vi.mock("@/lib/auth/session", () => ({
  getSession: async () => session,
  deleteSession: async () => {},
}));

afterEach(() => {
  session = null;
});

let count = 0;
async function userNamed(prefix: string): Promise<{ id: number; name: string }> {
  count += 1;
  const id = await seedUser();
  const name = `${prefix}_action_${count}`;
  await db.update(users).set({ username: name }).where(eq(users.id, id));
  return { id, name };
}

async function signIn(prefix: string) {
  const user = await userNamed(prefix);
  session = { userId: user.id };
  return user;
}

async function availability(name: string) {
  const result = await checkUsernameAction(name);
  if (!result.ok) throw new Error(result.error);
  return result.availability;
}

describe("username actions", () => {
  it("need a signed-in person", async () => {
    expect(await getUsernameAction()).toEqual({ ok: false, error: "Unauthorized" });
    expect(await checkUsernameAction("free_name")).toEqual({ ok: false, error: "Unauthorized" });
    expect(await suggestUsernameAction()).toEqual({ ok: false, error: "Unauthorized" });
    expect(await changeUsernameAction("free_name")).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("checks a name while typing: free, taken, held, broken or your own", async () => {
    const ana = await userNamed("ana");
    const leaver = await userNamed("leaver");
    await changeUsername(leaver.id, `${leaver.name}_new`);
    const sam = await signIn("sam");

    expect(await availability(`${sam.name}_x`)).toEqual({ status: "available" });
    expect(await availability(ana.name.toUpperCase())).toEqual({ status: "taken" });
    expect(await availability(leaver.name)).toEqual({ status: "taken" });
    expect(await availability("support")).toEqual({
      status: "invalid",
      problem: "that username is reserved",
    });
    expect(await availability(` ${sam.name} `)).toEqual({ status: "same" });
    expect(await checkUsernameAction("a".repeat(65))).toMatchObject({ ok: false });
  });

  it("suggests a name that is free to take", async () => {
    await signIn("sam");
    const result = await suggestUsernameAction();
    if (!result.ok) throw new Error(result.error);
    expect(await availability(result.username)).toEqual({ status: "available" });
  });

  it("renames and returns what's left", async () => {
    const sam = await signIn("sam");

    expect(await changeUsernameAction(`${sam.name}_v2`)).toEqual({
      ok: true,
      username: `${sam.name}_v2`,
      allowance: { used: 1, limit: USERNAME_CHANGES_PER_WINDOW, bonus: 0, nextFreeAt: null },
    });
    expect(await getUsernameAction()).toMatchObject({ ok: true, username: `${sam.name}_v2` });
  });

  it("explains a refused rename and changes nothing", async () => {
    const ana = await userNamed("ana");
    const sam = await signIn("sam");

    expect(await changeUsernameAction(ana.name)).toEqual({
      ok: false,
      error: "that username is taken",
    });
    expect(await changeUsernameAction("ab")).toEqual({
      ok: false,
      error: "a username needs at least 3 characters",
    });
    expect(await changeUsernameAction(sam.name)).toEqual({
      ok: false,
      error: "that's already your username",
    });
    expect(await getUsernameAction()).toMatchObject({ ok: true, username: sam.name });
  });

  it("stops at the monthly limit, then uses a bonus change", async () => {
    const sam = await signIn("sam");
    for (let i = 1; i <= USERNAME_CHANGES_PER_WINDOW; i++) {
      expect(await changeUsernameAction(`${sam.name}_${i}`)).toMatchObject({ ok: true });
    }

    expect(await changeUsernameAction(`${sam.name}_over`)).toEqual({
      ok: false,
      error: "no username changes left for now",
    });

    await db.update(users).set({ usernameBonusChanges: 1 }).where(eq(users.id, sam.id));
    const result = await changeUsernameAction(`${sam.name}_bonus`);
    expect(result).toMatchObject({ ok: true, allowance: { bonus: 0 } });
    expect(result.ok && result.allowance.nextFreeAt).toBeInstanceOf(Date);
  });
});

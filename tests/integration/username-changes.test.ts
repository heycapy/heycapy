import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { usernameChanges, users } from "@/lib/db/schema";
import { changeUsername, usernameAllowance } from "@/lib/account/username";
import { DAY_MS } from "@/lib/account/constants";
import { seedUser } from "./helpers";

const NOW = new Date("2026-10-19T12:00:00Z");
const daysLater = (days: number) => new Date(NOW.getTime() + days * DAY_MS);

let count = 0;
async function userNamed(prefix: string): Promise<{ id: number; name: string }> {
  count += 1;
  const id = await seedUser();
  const name = `${prefix}_${count}`;
  await db.update(users).set({ username: name }).where(eq(users.id, id));
  return { id, name };
}

async function userRow(id: number) {
  const [row] = await db.select().from(users).where(eq(users.id, id));
  return row;
}

describe("changing a username", () => {
  it("normalizes, saves and logs the change", async () => {
    const { id, name } = await userNamed("sam");

    expect(await changeUsername(id, "  Sam_Writes_1 ", { now: NOW })).toEqual({
      ok: true,
      username: "sam_writes_1",
    });
    expect((await userRow(id)).username).toBe("sam_writes_1");
    expect(
      await db.select().from(usernameChanges).where(eq(usernameChanges.userId, id))
    ).toMatchObject([
      { oldUsername: name, newUsername: "sam_writes_1", byAdmin: false, createdAt: NOW },
    ]);
  });

  it("refuses a name that breaks the rules, is the same, or belongs to someone else", async () => {
    const { id, name } = await userNamed("sam");
    const other = await userNamed("ana");

    expect(await changeUsername(id, "support", { now: NOW })).toEqual({
      ok: false,
      reason: "invalid",
      problem: "that username is reserved",
    });
    expect(await changeUsername(id, name.toUpperCase(), { now: NOW })).toEqual({
      ok: false,
      reason: "same",
    });
    expect(await changeUsername(id, other.name, { now: NOW })).toEqual({
      ok: false,
      reason: "taken",
    });
    expect((await userRow(id)).username).toBe(name);
  });

  it("holds an old name from everyone else for 30 days, but its owner can take it back", async () => {
    const sam = await userNamed("sam");
    const ana = await userNamed("ana");
    await changeUsername(sam.id, "sam_new_3", { now: NOW });

    expect(await changeUsername(ana.id, sam.name, { now: daysLater(29) })).toEqual({
      ok: false,
      reason: "taken",
    });
    expect(await changeUsername(sam.id, sam.name, { now: daysLater(1) })).toMatchObject({
      ok: true,
    });
  });

  it("lets an old name go to someone else once the hold is over", async () => {
    const sam = await userNamed("sam");
    const ana = await userNamed("ana");
    await changeUsername(sam.id, "sam_later_5", { now: NOW });

    expect(await changeUsername(ana.id, sam.name, { now: daysLater(31) })).toEqual({
      ok: true,
      username: sam.name,
    });
  });

  it("allows 2 changes in 30 days, then says when the next one frees up", async () => {
    const { id } = await userNamed("sam");
    await changeUsername(id, "sam_one_7", { now: NOW });
    await changeUsername(id, "sam_two_7", { now: daysLater(10) });

    expect(await changeUsername(id, "sam_three_7", { now: daysLater(20) })).toEqual({
      ok: false,
      reason: "limit",
      nextFreeAt: daysLater(30),
    });
    expect(await usernameAllowance(id, daysLater(20))).toEqual({
      used: 2,
      limit: 2,
      bonus: 0,
      nextFreeAt: daysLater(30),
    });
    expect(await changeUsername(id, "sam_three_7", { now: daysLater(31) })).toMatchObject({
      ok: true,
    });
  });

  it("uses a bonus change once the monthly ones are gone, and only then", async () => {
    const { id } = await userNamed("sam");
    await db.update(users).set({ usernameBonusChanges: 1 }).where(eq(users.id, id));

    await changeUsername(id, "sam_one_8", { now: NOW });
    await changeUsername(id, "sam_two_8", { now: NOW });
    expect((await userRow(id)).usernameBonusChanges).toBe(1);

    expect(await changeUsername(id, "sam_three_8", { now: NOW })).toMatchObject({ ok: true });
    expect((await userRow(id)).usernameBonusChanges).toBe(0);
    expect(await changeUsername(id, "sam_four_8", { now: NOW })).toMatchObject({
      ok: false,
      reason: "limit",
    });
  });

  it("says the next free change comes when enough old ones stop counting, bonus ones included", async () => {
    const { id } = await userNamed("sam");
    await db.update(users).set({ usernameBonusChanges: 1 }).where(eq(users.id, id));
    await changeUsername(id, "sam_one_9", { now: NOW });
    await changeUsername(id, "sam_two_9", { now: daysLater(5) });
    await changeUsername(id, "sam_three_9", { now: daysLater(10) });

    expect(await usernameAllowance(id, daysLater(11))).toMatchObject({
      used: 3,
      bonus: 0,
      nextFreeAt: daysLater(35),
    });
  });

  it("lets an admin rename past the allowance and the hold, logged as theirs and not counted", async () => {
    const sam = await userNamed("sam");
    const ana = await userNamed("ana");
    await changeUsername(sam.id, "sam_one_10", { now: NOW });
    await changeUsername(sam.id, "sam_two_10", { now: NOW });

    expect(await changeUsername(ana.id, sam.name, { byAdmin: true, now: NOW })).toEqual({
      ok: true,
      username: sam.name,
    });
    expect(await changeUsername(sam.id, "sam_fixed_10", { byAdmin: true, now: NOW })).toEqual({
      ok: true,
      username: "sam_fixed_10",
    });
    expect(await usernameAllowance(sam.id, NOW)).toMatchObject({ used: 2, bonus: 0 });
    expect(
      await db.select().from(usernameChanges).where(eq(usernameChanges.userId, sam.id))
    ).toMatchObject([{ byAdmin: false }, { byAdmin: false }, { byAdmin: true }]);
  });

  it("keeps an admin to the rules and to names someone has now", async () => {
    const sam = await userNamed("sam");
    const ana = await userNamed("ana");

    expect(await changeUsername(sam.id, "admin", { byAdmin: true, now: NOW })).toMatchObject({
      ok: false,
      reason: "invalid",
    });
    expect(await changeUsername(sam.id, ana.name, { byAdmin: true, now: NOW })).toEqual({
      ok: false,
      reason: "taken",
    });
  });

  it("is not_found for a user that doesn't exist", async () => {
    expect(await changeUsername(999_999, "nobody_here", { now: NOW })).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(await usernameAllowance(999_999, NOW)).toBeNull();
  });
});

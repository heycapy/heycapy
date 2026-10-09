import { describe, expect, it, vi } from "vitest";
import type * as CryptoModule from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import {
  USERNAME_ACTIVITIES,
  USERNAME_ADJECTIVES,
  USERNAME_ANIMALS,
  USERNAME_PLAIN_ATTEMPTS,
} from "@/lib/account/constants";
import { assignUsername, backfillUsernames, generateUsername } from "@/lib/account/username";

const pick = vi.hoisted(() => ({ alwaysFirst: false }));
vi.mock("node:crypto", async (importOriginal) => {
  const original = await importOriginal<typeof CryptoModule>();
  return {
    ...original,
    randomInt: (...args: number[]) =>
      pick.alwaysFirst && args.length === 1 ? 0 : original.randomInt(...(args as [number, number])),
  };
});

const SHAPE = /^[a-z]+_[a-z]+_[a-z]+(_\d+)?$/;

async function insertUser(username: string | null = null): Promise<number> {
  const [user] = await db
    .insert(users)
    .values({ email: `username-${Math.random()}@heycapy.test`, username })
    .returning();
  return user.id;
}

async function usernameOf(id: number): Promise<string | null> {
  const row = await db.query.users.findFirst({
    columns: { username: true },
    where: eq(users.id, id),
  });
  return row?.username ?? null;
}

describe("generateUsername", () => {
  it("builds adjective_animal_activity from the word lists", () => {
    for (let i = 0; i < 200; i++) {
      const [adjective, animal, activity] = generateUsername().split("_");
      expect(USERNAME_ADJECTIVES).toContain(adjective);
      expect(USERNAME_ANIMALS).toContain(animal);
      expect(USERNAME_ACTIVITIES).toContain(activity);
    }
  });

  it("adds a number once the plain attempts are used up", () => {
    expect(generateUsername(USERNAME_PLAIN_ATTEMPTS - 1)).not.toMatch(/\d/);
    expect(generateUsername(USERNAME_PLAIN_ATTEMPTS)).toMatch(/_\d+$/);
  });

  it("keeps every word lowercase letters and every list free of repeats", () => {
    for (const list of [USERNAME_ADJECTIVES, USERNAME_ANIMALS, USERNAME_ACTIVITIES]) {
      expect(new Set(list).size).toBe(list.length);
      for (const word of list) expect(word).toMatch(/^[a-z]+$/);
    }
  });
});

describe("assignUsername", () => {
  it("gives a new user a username and keeps it on a second call", async () => {
    const id = await insertUser();
    const first = await assignUsername(id);
    expect(first).toMatch(SHAPE);
    expect(await usernameOf(id)).toBe(first);
    expect(await assignUsername(id)).toBe(first);
  });

  it("never gives two users the same username, even when every plain pick collides", async () => {
    pick.alwaysFirst = true;
    try {
      const ids = await Promise.all(Array.from({ length: 30 }, () => insertUser()));
      const names: string[] = [];
      for (const id of ids) names.push(await assignUsername(id));

      expect(new Set(names).size).toBe(names.length);
      expect(names.filter((name) => !/\d$/.test(name))).toHaveLength(1);
    } finally {
      pick.alwaysFirst = false;
    }
  });
});

describe("backfillUsernames", () => {
  it("fills in users that have none and leaves existing usernames alone", async () => {
    const kept = await insertUser("kept_by_hand_naming");
    const missing = await insertUser();

    await backfillUsernames();

    expect(await usernameOf(kept)).toBe("kept_by_hand_naming");
    expect(await usernameOf(missing)).toMatch(SHAPE);
  });
});

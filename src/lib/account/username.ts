import { randomInt } from "node:crypto";
import { and, asc, eq, gt, isNull, ne, notExists, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { usernameChanges, users } from "@/lib/db/schema";
import { normalizeUsername, usernameProblem } from "./username-rules";
import {
  USERNAME_ACTIVITIES,
  USERNAME_ADJECTIVES,
  USERNAME_ANIMALS,
  DAY_MS,
  USERNAME_CHANGE_WINDOW_DAYS,
  USERNAME_CHANGES_PER_WINDOW,
  USERNAME_HOLD_DAYS,
  USERNAME_MAX_ATTEMPTS,
  USERNAME_PLAIN_ATTEMPTS,
  USERNAME_SUFFIX_MAX,
  USERNAME_SUFFIX_MIN,
} from "./constants";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function daysBefore(now: Date, days: number): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

// A name someone else let go of lately, taking back your own old name is fine
function heldFromOthers(q: Tx | typeof db, name: string, userId: number, now: Date) {
  return q
    .select({ one: sql`1` })
    .from(usernameChanges)
    .where(
      and(
        eq(usernameChanges.oldUsername, name),
        ne(usernameChanges.userId, userId),
        gt(usernameChanges.createdAt, daysBefore(now, USERNAME_HOLD_DAYS))
      )
    );
}

function pick(words: readonly string[]): string {
  return words[randomInt(words.length)];
}

export function generateUsername(attempt = 0): string {
  const base = [pick(USERNAME_ADJECTIVES), pick(USERNAME_ANIMALS), pick(USERNAME_ACTIVITIES)].join(
    "_"
  );
  if (attempt < USERNAME_PLAIN_ATTEMPTS) return base;
  return `${base}_${randomInt(USERNAME_SUFFIX_MIN, USERNAME_SUFFIX_MAX + 1)}`;
}

// The taken check and the write are one statement, so two sign-ups can't pick the same name,
// the unique index still backs it up
export async function assignUsername(userId: number): Promise<string> {
  const existing = await db.query.users.findFirst({
    columns: { username: true },
    where: eq(users.id, userId),
  });
  if (existing?.username) return existing.username;

  for (let attempt = 0; attempt < USERNAME_MAX_ATTEMPTS; attempt++) {
    const candidate = generateUsername(attempt);
    const [claimed] = await db
      .update(users)
      .set({ username: candidate })
      .where(
        and(
          eq(users.id, userId),
          isNull(users.username),
          notExists(
            db
              .select({ one: sql`1` })
              .from(users)
              .where(eq(users.username, candidate))
          ),
          notExists(heldFromOthers(db, candidate, userId, new Date()))
        )
      )
      .returning({ username: users.username });
    if (claimed?.username) return claimed.username;
  }
  throw new Error(`could not find a free username for user ${userId}`);
}

export async function backfillUsernames(): Promise<void> {
  const missing = await db.select({ id: users.id }).from(users).where(isNull(users.username));
  for (const { id } of missing) await assignUsername(id);
}

export type UsernameAllowance = {
  used: number;
  limit: number;
  bonus: number;
  // Set once the monthly changes are used up: when the oldest of them stops counting
  nextFreeAt: Date | null;
};

export type UsernameChangeResult =
  | { ok: true; username: string }
  | { ok: false; reason: "invalid"; problem: string }
  | { ok: false; reason: "not_found" | "same" | "taken" }
  | { ok: false; reason: "limit"; nextFreeAt: Date };

function allowanceOf(tx: Tx | typeof db, userId: number, bonus: number, now: Date) {
  const own = tx
    .select({ at: usernameChanges.createdAt })
    .from(usernameChanges)
    .where(
      and(
        eq(usernameChanges.userId, userId),
        eq(usernameChanges.byAdmin, false),
        gt(usernameChanges.createdAt, daysBefore(now, USERNAME_CHANGE_WINDOW_DAYS))
      )
    )
    .orderBy(asc(usernameChanges.createdAt))
    .all();
  const limit = USERNAME_CHANGES_PER_WINDOW;
  const freedBy = own.length >= limit ? own[own.length - limit] : undefined;
  return {
    used: own.length,
    limit,
    bonus,
    nextFreeAt: freedBy
      ? new Date(freedBy.at.getTime() + USERNAME_CHANGE_WINDOW_DAYS * DAY_MS)
      : null,
  } satisfies UsernameAllowance;
}

export async function usernameAllowance(
  userId: number,
  now = new Date()
): Promise<UsernameAllowance | null> {
  const user = await db.query.users.findFirst({
    columns: { usernameBonusChanges: true },
    where: eq(users.id, userId),
  });
  return user ? allowanceOf(db, userId, user.usernameBonusChanges, now) : null;
}

// An admin's rename skips the allowance and the hold on old names, never the other rules
export async function changeUsername(
  userId: number,
  input: string,
  { byAdmin = false, now = new Date() }: { byAdmin?: boolean; now?: Date } = {}
): Promise<UsernameChangeResult> {
  const name = normalizeUsername(input);
  const problem = usernameProblem(name);
  if (problem) return { ok: false, reason: "invalid", problem };

  return db.transaction((tx): UsernameChangeResult => {
    const user = tx
      .select({ username: users.username, bonus: users.usernameBonusChanges })
      .from(users)
      .where(eq(users.id, userId))
      .get();
    if (!user) return { ok: false, reason: "not_found" };
    if (user.username === name) return { ok: false, reason: "same" };
    const taken = tx.select({ id: users.id }).from(users).where(eq(users.username, name)).get();
    if (taken || (!byAdmin && heldFromOthers(tx, name, userId, now).get())) {
      return { ok: false, reason: "taken" };
    }

    let useBonus = false;
    if (!byAdmin) {
      const { nextFreeAt } = allowanceOf(tx, userId, user.bonus, now);
      if (nextFreeAt && user.bonus === 0) return { ok: false, reason: "limit", nextFreeAt };
      useBonus = nextFreeAt !== null;
    }

    tx.update(users)
      .set({
        username: name,
        ...(useBonus && { usernameBonusChanges: sql`${users.usernameBonusChanges} - 1` }),
      })
      .where(eq(users.id, userId))
      .run();
    tx.insert(usernameChanges)
      .values({ userId, oldUsername: user.username, newUsername: name, byAdmin, createdAt: now })
      .run();
    return { ok: true, username: name };
  });
}

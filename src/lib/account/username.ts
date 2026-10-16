import { randomInt } from "node:crypto";
import { and, eq, isNull, notExists, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import {
  USERNAME_ACTIVITIES,
  USERNAME_ADJECTIVES,
  USERNAME_ANIMALS,
  USERNAME_MAX_ATTEMPTS,
  USERNAME_PLAIN_ATTEMPTS,
  USERNAME_SUFFIX_MAX,
  USERNAME_SUFFIX_MIN,
} from "./constants";

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

// The taken check and the write are one statement, so two sign-ups can't pick the same name;
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
          )
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

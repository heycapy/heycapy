import { readFileSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

type Journal = { entries: { tag: string; when: number }[] };

// drizzle only applies migrations newer than the database's last one, so older code would start
// on a newer database without noticing and fail on the first query that touches what changed
export function databaseAheadOfCode<S extends Record<string, unknown>>(
  db: BetterSQLite3Database<S>,
  migrationsFolder: string
): string | null {
  const tracked = db.get<{ found: number }>(
    sql`SELECT count(*) AS found FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'`
  );
  if (tracked.found === 0) return null;

  const applied = db.get<{ newest: number | null }>(
    sql`SELECT max(created_at) AS newest FROM __drizzle_migrations`
  );
  const journal = JSON.parse(
    readFileSync(path.join(migrationsFolder, "meta/_journal.json"), "utf8")
  ) as Journal;
  const known = journal.entries.at(-1);
  if (applied.newest === null || !known || Number(applied.newest) <= known.when) return null;

  return `the database was migrated by a newer version of heycapy, this one only knows migrations up to ${known.tag}. run that newer version, or restore the backup from before it`;
}

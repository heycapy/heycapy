import { mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { DATABASE_BACKUPS_KEPT, DEFAULT_DATABASE_URL } from "./constants";

export type Schema = typeof schema;
export type DB = BetterSQLite3Database<Schema>;

export function databaseFilePath(): string {
  const url = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
  return url.startsWith("file:") ? url.slice("file:".length) : url;
}

const sqlite = new Database(databaseFilePath());
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db: DB = drizzle(sqlite, { schema });

// Daily copy next to the database; keeps the newest few
export async function backupDatabase(now = new Date()): Promise<string> {
  const dir = path.join(path.dirname(path.resolve(databaseFilePath())), "backups");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `heycapy-${now.toISOString().slice(0, 10)}.db`);
  await sqlite.backup(file);
  // A single self-contained file is what a restore copies back
  const copy = new Database(file);
  copy.pragma("journal_mode = DELETE");
  copy.close();

  const backups = readdirSync(dir)
    .filter((f) => /^heycapy-\d{4}-\d{2}-\d{2}\.db$/.test(f))
    .sort()
    .reverse();
  for (const old of backups.slice(DATABASE_BACKUPS_KEPT)) rmSync(path.join(dir, old));
  return file;
}

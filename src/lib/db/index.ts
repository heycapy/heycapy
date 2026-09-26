import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

export type Schema = typeof schema;
export type DB = BetterSQLite3Database<Schema>;

function createDb(): DB {
  const url = process.env.DATABASE_URL ?? "file:heycapy.db";

  if (url.startsWith("postgres")) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Pool } = require("pg");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { drizzle: drizzlePg } = require("drizzle-orm/node-postgres");
      const pool = new Pool({ connectionString: url });
      return drizzlePg(pool, { schema }) as unknown as DB;
    } catch {
      throw new Error("Postgres mode requires the 'pg' package. Run: pnpm add pg");
    }
  }

  const path = url.startsWith("file:") ? url.slice(5) : url;
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  return drizzle(sqlite, { schema });
}

export const db = createDb();

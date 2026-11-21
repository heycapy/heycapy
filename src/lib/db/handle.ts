import type Database from "better-sqlite3";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import type { Schema } from "./index";

// What `db` and the transaction a `db.transaction` callback receives both are, so a rule written
// against it runs on either. Synchronous on purpose: a transaction commits when its callback
// returns, so nothing inside it may wait
export type DbHandle = BaseSQLiteDatabase<"sync", Database.RunResult, Schema>;

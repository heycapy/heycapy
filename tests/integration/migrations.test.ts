import { describe, it, expect } from "vitest";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const MIGRATIONS = path.join(import.meta.dirname, "../../src/lib/db/migrations");

type Journal = { entries: { tag: string; when: number }[] };

/** A copy of the migrations folder containing only the first `count` migrations. */
function migrationsUpTo(count: number): string {
  const dir = mkdtempSync(path.join(tmpdir(), "heycapy-migrations-"));
  cpSync(MIGRATIONS, dir, { recursive: true });
  const journalPath = path.join(dir, "meta/_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as Journal;
  journal.entries = journal.entries.slice(0, count);
  writeFileSync(journalPath, JSON.stringify(journal));
  return dir;
}

describe("migrations", () => {
  it("are ordered so each new one runs on databases that already applied the previous ones", () => {
    const journal = JSON.parse(
      readFileSync(path.join(MIGRATIONS, "meta/_journal.json"), "utf8")
    ) as Journal;
    const times = journal.entries.map((e) => e.when);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(new Set(times).size).toBe(times.length);
  });

  it("upgrade an existing database to the latest schema", () => {
    const journal = JSON.parse(
      readFileSync(path.join(MIGRATIONS, "meta/_journal.json"), "utf8")
    ) as Journal;
    const dbPath = path.join(mkdtempSync(path.join(tmpdir(), "heycapy-upgrade-")), "db.sqlite");
    const sqlite = new Database(dbPath);
    const db = drizzle(sqlite);

    for (let applied = 1; applied <= journal.entries.length; applied++) {
      migrate(db, { migrationsFolder: migrationsUpTo(applied) });
    }

    const columns = sqlite.prepare("PRAGMA table_info(items)").all() as { name: string }[];
    expect(columns.map((c) => c.name)).toEqual(
      expect.arrayContaining(["next_reminder_at", "next_overdue_at"])
    );
    sqlite.close();
  });
});

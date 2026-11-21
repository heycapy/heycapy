import { afterAll, describe, it, expect } from "vitest";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const MIGRATIONS = path.join(import.meta.dirname, "../../src/lib/db/migrations");

type Journal = { entries: { tag: string }[] };

const tempDirs: string[] = [];
afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

function tempDir(prefix: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function migrationsUpTo(tag: string): string {
  const dir = tempDir("heycapy-migrations-");
  cpSync(MIGRATIONS, dir, { recursive: true });
  const journalPath = path.join(dir, "meta/_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as Journal;
  journal.entries = journal.entries.slice(
    0,
    journal.entries.findIndex((e) => e.tag === tag)
  );
  writeFileSync(journalPath, JSON.stringify(journal));
  return dir;
}

function openBeforeMigration(folder = MIGRATIONS) {
  const sqlite = new Database(path.join(tempDir("heycapy-sync-"), "db.sqlite"));
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder: migrationsUpTo("0057_sync_revisions") });
  return { sqlite, db, folder };
}

function seed(sqlite: Database.Database) {
  sqlite.exec(`
    INSERT INTO users (email) VALUES ('a@heycapy.test'), ('b@heycapy.test'), ('c@heycapy.test');
    INSERT INTO buckets (user_id, name) VALUES (1, 'home'), (2, 'work');
    INSERT INTO bucket_members (bucket_id, user_id) VALUES (1, 3);
    INSERT INTO items (id, bucket_id, user_id, title) VALUES
      ('i-1', 1, 1, 'one'), ('i-2', 1, 1, 'two'), ('i-3', 2, 2, 'three'), ('i-4', 2, 2, 'four');
    INSERT INTO item_assignees (item_id, user_id) VALUES ('i-1', 3);
    INSERT INTO item_reminders (item_id, user_id) VALUES ('i-1', 1), ('i-1', 3), ('i-3', 2);
  `);
}

const TABLES = ["buckets", "bucket_members", "items", "item_reminders"] as const;

function everyRevision(sqlite: Database.Database) {
  return TABLES.flatMap((table) =>
    (
      sqlite.prepare(`SELECT id, rev FROM ${table}`).all() as { id: number | string; rev: number }[]
    ).map((row) => ({ table, ...row }))
  ).sort((a, b) => a.rev - b.rev);
}

describe("migration 0057, revisions for what already exists", () => {
  it("numbers every existing row once, tables in a fixed order and each by its id", () => {
    const { sqlite, db, folder } = openBeforeMigration();
    seed(sqlite);

    migrate(db, { migrationsFolder: folder });

    const all = everyRevision(sqlite);
    expect(all.map((r) => r.rev)).toEqual(Array.from({ length: all.length }, (_, i) => i + 1));
    expect(all.map((r) => r.table)).toEqual([
      ...Array(2).fill("buckets"),
      ...Array(3).fill("bucket_members"),
      ...Array(4).fill("items"),
      ...Array(3).fill("item_reminders"),
    ]);
    for (const table of TABLES) {
      const ids = all.filter((r) => r.table === table).map((r) => r.id);
      expect(ids, table).toEqual([...ids].sort((a, b) => (a < b ? -1 : 1)));
    }
    expect(sqlite.prepare("SELECT rev, min_rev FROM sync_state").all()).toEqual([
      { rev: all.length, min_rev: 0 },
    ]);
  });

  it("carries on from the counter, the triggers work straight away", () => {
    const { sqlite, db, folder } = openBeforeMigration();
    seed(sqlite);
    migrate(db, { migrationsFolder: folder });
    const counter = () =>
      (sqlite.prepare("SELECT rev FROM sync_state").get() as { rev: number }).rev;
    const before = counter();

    sqlite.prepare("UPDATE items SET title = 'uno' WHERE id = 'i-1'").run();
    expect(counter()).toBe(before + 1);
    expect(sqlite.prepare("SELECT rev FROM items WHERE id = 'i-1'").get()).toEqual({
      rev: before + 1,
    });

    sqlite.prepare("DELETE FROM items WHERE id = 'i-4'").run();
    expect(sqlite.prepare("SELECT rev, entity, entity_id FROM sync_tombstones").all()).toEqual([
      { rev: before + 2, entity: "item", entity_id: "i-4" },
    ]);
  });

  it("creates the indexes and triggers", () => {
    const { sqlite, db, folder } = openBeforeMigration();

    migrate(db, { migrationsFolder: folder });

    const names = (
      sqlite.prepare("SELECT name FROM sqlite_master WHERE type IN ('index', 'trigger')").all() as {
        name: string;
      }[]
    ).map((r) => r.name);
    const expected = [
      ...TABLES.flatMap((t) => [
        `idx_${t}_rev`,
        `${t}_rev_insert`,
        `${t}_rev_update`,
        `${t}_tombstone`,
      ]),
      "item_assignees_touch_insert",
      "item_assignees_touch_update",
      "item_assignees_touch_delete",
      "users_profile_touch_memberships",
    ];
    expect(names).toEqual(expect.arrayContaining(expected));
    expect(sqlite.pragma("foreign_key_check")).toEqual([]);
  });

  it("starts the counter at zero on an empty database, and the first write is number one", () => {
    const { sqlite, db, folder } = openBeforeMigration();

    migrate(db, { migrationsFolder: folder });

    expect(sqlite.prepare("SELECT rev, min_rev FROM sync_state").all()).toEqual([
      { rev: 0, min_rev: 0 },
    ]);
    sqlite.prepare("INSERT INTO users (email) VALUES ('a@heycapy.test')").run();
    sqlite.prepare("INSERT INTO buckets (user_id, name) VALUES (1, 'home')").run();
    expect(everyRevision(sqlite).map((r) => [r.table, r.rev])).toEqual([
      ["buckets", 1],
      ["bucket_members", 2],
    ]);
  });

  it("does nothing a second time", () => {
    const { sqlite, db, folder } = openBeforeMigration();
    seed(sqlite);
    migrate(db, { migrationsFolder: folder });
    const once = everyRevision(sqlite);

    migrate(db, { migrationsFolder: folder });

    expect(everyRevision(sqlite)).toEqual(once);
  });

  it("keeps only one counter row", () => {
    const { sqlite, db, folder } = openBeforeMigration();
    migrate(db, { migrationsFolder: folder });

    expect(() => sqlite.prepare("INSERT INTO sync_state (id) VALUES (2)").run()).toThrow(
      /CHECK constraint/
    );
  });
});

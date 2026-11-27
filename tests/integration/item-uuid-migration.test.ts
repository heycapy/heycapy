import { afterAll, describe, it, expect } from "vitest";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const MIGRATIONS = path.join(import.meta.dirname, "../../src/lib/db/migrations");
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const NOW = 1_794_000_000;

type Journal = { entries: { tag: string; when: number }[] };
type Row = Record<string, unknown>;

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

// The app opens its database with foreign keys on, so the test does too
function openBeforeMigration() {
  const sqlite = new Database(path.join(tempDir("heycapy-uuid-"), "db.sqlite"));
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder: migrationsUpTo("0056_item_uuid_ids") });
  return { sqlite, db };
}

function seed(sqlite: Database.Database) {
  const insert = (sql: string, ...values: unknown[]) => sqlite.prepare(sql).run(...values);
  insert("INSERT INTO users (email) VALUES ('a@heycapy.test'), ('b@heycapy.test')");
  insert("INSERT INTO buckets (user_id, name) VALUES (1, 'home'), (2, 'work')");
  // Two share a creation second, so the order inside it has to survive
  const created = [NOW, NOW, NOW, NOW + 60, NOW + 3600];
  created.forEach((at, i) =>
    insert(
      `INSERT INTO items (bucket_id, user_id, title, deadline, deadline_timezone, status, properties, sort_order, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, 'Asia/Kolkata', ?, ?, ?, ?, ?, ?)`,
      i < 4 ? 1 : 2,
      i < 4 ? 1 : 2,
      `item ${i}`,
      NOW + 86_400 * (i + 1),
      i === 3 ? "completed" : "active",
      i === 1 ? '{"gift":"book"}' : null,
      i,
      at,
      at,
      i === 2 ? NOW + 10 : null
    )
  );
  insert("INSERT INTO item_assignees (item_id, user_id) VALUES (1, 1), (1, 2), (4, 2)");
  insert(
    `INSERT INTO item_reminders (item_id, user_id, notified_at, overdue_notified_at, next_reminder_at, next_overdue_at)
     VALUES (1, 1, NULL, NULL, ?, ?), (1, 2, ?, NULL, NULL, ?), (2, 1, NULL, NULL, ?, NULL), (5, 2, NULL, ?, NULL, NULL)`,
    NOW + 100,
    NOW + 200,
    NOW + 5,
    NOW + 300,
    NOW + 400,
    NOW + 6
  );
  insert(
    `INSERT INTO notification_queue (user_id, item_id, medium, title, message, status, kind, attempts)
     VALUES (1, 1, 'telegram', 't1', 'm1', 'pending', 'reminder', 0),
            (1, 2, 'email', 't2', 'm2', 'sent', 'overdue', 2),
            (2, NULL, 'push', 't3', 'm3', 'dead', NULL, 3)`
  );
  insert(
    `INSERT INTO notification_log (item_id, user_id, medium, message, status)
     VALUES (1, 1, 'telegram', 'l1', 'sent'), (NULL, 2, 'email', 'l2', 'failed')`
  );
  insert(
    `INSERT INTO item_actions (user_id, item_id, action, source, remind_at)
     VALUES (1, 1, 'remind_again', 'telegram', ?), (2, 4, 'complete', 'email', NULL)`,
    NOW + 900
  );
}

// Every child row described by the title of the item it points at, so the old and new ids don't matter
function relations(sqlite: Database.Database): Record<string, Row[]> {
  const q = (sql: string) => sqlite.prepare(sql).all() as Row[];
  return {
    items: q(
      `SELECT title, bucket_id, user_id, deadline, deadline_timezone, status, properties, sort_order, created_at, updated_at, deleted_at FROM items ORDER BY title`
    ),
    assignees: q(
      `SELECT i.title, a.user_id FROM item_assignees a JOIN items i ON i.id = a.item_id ORDER BY i.title, a.user_id`
    ),
    reminders: q(
      `SELECT i.title, r.user_id, r.notified_at, r.overdue_notified_at, r.next_reminder_at, r.next_overdue_at FROM item_reminders r JOIN items i ON i.id = r.item_id ORDER BY i.title, r.user_id`
    ),
    queue: q(
      `SELECT q.id, i.title, q.medium, q.status, q.kind, q.attempts, q.message FROM notification_queue q LEFT JOIN items i ON i.id = q.item_id ORDER BY q.id`
    ),
    log: q(
      `SELECT l.id, i.title, l.medium, l.status, l.message FROM notification_log l LEFT JOIN items i ON i.id = l.item_id ORDER BY l.id`
    ),
    actions: q(
      `SELECT a.id, i.title, a.action, a.source, a.remind_at FROM item_actions a JOIN items i ON i.id = a.item_id ORDER BY a.id`
    ),
  };
}

describe("migration 0056, item ids become UUIDs", () => {
  it("keeps every item and everything that points at it", () => {
    const { sqlite, db } = openBeforeMigration();
    seed(sqlite);
    const before = relations(sqlite);
    const counts = Object.fromEntries(Object.entries(before).map(([k, v]) => [k, v.length]));
    expect(counts).toEqual({ items: 5, assignees: 3, reminders: 4, queue: 3, log: 2, actions: 2 });

    migrate(db, { migrationsFolder: MIGRATIONS });

    expect(relations(sqlite)).toEqual(before);
  });

  it("gives every item a distinct UUIDv7 that keeps the old order", () => {
    const { sqlite, db } = openBeforeMigration();
    seed(sqlite);
    const oldOrder = (
      sqlite.prepare("SELECT title FROM items ORDER BY id").all() as { title: string }[]
    ).map((r) => r.title);

    migrate(db, { migrationsFolder: MIGRATIONS });

    const rows = sqlite.prepare("SELECT id, title FROM items ORDER BY id").all() as {
      id: string;
      title: string;
    }[];
    expect(rows.every((r) => UUID_V7.test(r.id))).toBe(true);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    expect(rows.map((r) => r.title)).toEqual(oldOrder);
  });

  it("leaves a consistent database: no broken references, the right shape, nothing left over", () => {
    const { sqlite, db } = openBeforeMigration();
    seed(sqlite);

    migrate(db, { migrationsFolder: MIGRATIONS });

    expect(sqlite.pragma("foreign_key_check")).toEqual([]);
    expect(sqlite.pragma("foreign_keys", { simple: true })).toBe(1);
    const tables = (
      sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
        name: string;
      }[]
    ).map((t) => t.name);
    expect(tables.filter((t) => t.startsWith("__new_") || t === "__item_ids")).toEqual([]);
    expect(tables).not.toContain("__guard");
    for (const table of [
      "items",
      "item_assignees",
      "item_reminders",
      "item_actions",
      "notification_log",
      "notification_queue",
    ]) {
      const columns = sqlite.pragma(`table_info(${table})`) as { name: string; type: string }[];
      const idColumn = columns.find((c) => c.name === (table === "items" ? "id" : "item_id"));
      expect(idColumn?.type, table).toBe("TEXT");
    }
    const names = (
      sqlite.prepare("SELECT name FROM sqlite_master WHERE type IN ('index', 'trigger')").all() as {
        name: string;
      }[]
    ).map((r) => r.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "idx_item_actions_item_id",
        "idx_item_assignees_item_user",
        "idx_item_assignees_user_id",
        "idx_item_reminders_item_user",
        "idx_item_reminders_user_id",
        "idx_item_reminders_next_reminder_at",
        "idx_item_reminders_next_overdue_at",
        "items_notified_at_for_everyone",
        "items_overdue_notified_at_for_everyone",
      ])
    );
  });

  it("keeps the triggers that copy a notified time to everyone, and the cascades", () => {
    const { sqlite, db } = openBeforeMigration();
    seed(sqlite);
    migrate(db, { migrationsFolder: MIGRATIONS });

    const first = sqlite.prepare("SELECT id FROM items WHERE title = 'item 0'").get() as {
      id: string;
    };
    sqlite.prepare("UPDATE items SET notified_at = ? WHERE id = ?").run(NOW + 77, first.id);
    const notified = sqlite
      .prepare("SELECT notified_at FROM item_reminders WHERE item_id = ?")
      .all(first.id) as { notified_at: number }[];
    expect(notified.map((r) => r.notified_at)).toEqual([NOW + 77, NOW + 77]);

    sqlite.prepare("DELETE FROM items WHERE id = ?").run(first.id);
    for (const table of ["item_assignees", "item_reminders", "item_actions"]) {
      expect(
        sqlite.prepare(`SELECT count(*) AS c FROM ${table} WHERE item_id = ?`).get(first.id),
        table
      ).toEqual({ c: 0 });
    }
    expect(sqlite.prepare("SELECT count(*) AS c FROM notification_queue").get()).toEqual({ c: 3 });
    expect(
      sqlite.prepare("SELECT count(*) AS c FROM notification_queue WHERE item_id = ?").get(first.id)
    ).toEqual({ c: 0 });
  });

  it("does nothing a second time", () => {
    const { sqlite, db } = openBeforeMigration();
    seed(sqlite);
    migrate(db, { migrationsFolder: MIGRATIONS });
    const once = relations(sqlite);
    const ids = sqlite.prepare("SELECT id FROM items ORDER BY id").all();

    migrate(db, { migrationsFolder: MIGRATIONS });

    expect(relations(sqlite)).toEqual(once);
    expect(sqlite.prepare("SELECT id FROM items ORDER BY id").all()).toEqual(ids);
  });

  it("runs on an empty database", () => {
    const { sqlite, db } = openBeforeMigration();

    migrate(db, { migrationsFolder: MIGRATIONS });

    expect(sqlite.prepare("SELECT count(*) AS c FROM items").get()).toEqual({ c: 0 });
    expect(sqlite.pragma("foreign_key_check")).toEqual([]);
  });

  it("drops the old assignee column when every value in it is also an assignee row", () => {
    const { sqlite, db } = openBeforeMigration();
    seed(sqlite);
    sqlite.prepare("UPDATE items SET assignee_id = 2 WHERE title = 'item 0'").run();

    migrate(db, { migrationsFolder: MIGRATIONS });

    expect(sqlite.prepare("SELECT count(*) AS c FROM items").get()).toEqual({ c: 5 });
    expect(
      (sqlite.pragma("table_info(items)") as { name: string }[]).some(
        (c) => c.name === "assignee_id"
      )
    ).toBe(false);
  });

  it("stops and changes nothing when an old assignee has no assignee row, it would be lost", () => {
    const { sqlite, db } = openBeforeMigration();
    seed(sqlite);
    sqlite.prepare("UPDATE items SET assignee_id = 1 WHERE title = 'item 1'").run();
    const before = relations(sqlite);

    expect(() => migrate(db, { migrationsFolder: MIGRATIONS })).toThrow();

    const idColumn = (sqlite.pragma("table_info(items)") as { name: string; type: string }[]).find(
      (c) => c.name === "id"
    );
    expect(idColumn?.type).toBe("INTEGER");
    expect(relations(sqlite)).toEqual(before);
    expect(sqlite.pragma("foreign_key_check")).toEqual([]);
  });
});

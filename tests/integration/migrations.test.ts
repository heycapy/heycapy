import { describe, it, expect } from "vitest";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const MIGRATIONS = path.join(import.meta.dirname, "../../src/lib/db/migrations");

type Journal = { entries: { tag: string; when: number }[] };

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

  it("turn the snoozed status into on hold and keep the not-before time", () => {
    const journal = JSON.parse(
      readFileSync(path.join(MIGRATIONS, "meta/_journal.json"), "utf8")
    ) as Journal;
    const onHoldMigration = journal.entries.findIndex((e) => e.tag === "0008_on_hold_status");
    const dbPath = path.join(mkdtempSync(path.join(tmpdir(), "heycapy-on-hold-")), "db.sqlite");
    const sqlite = new Database(dbPath);
    const db = drizzle(sqlite);
    migrate(db, { migrationsFolder: migrationsUpTo(onHoldMigration) });

    const statuses = JSON.stringify({
      fields: [],
      statuses: [
        { name: "active", color: "#22c55e" },
        { name: "snoozed", color: "#f59e0b" },
      ],
    });
    sqlite.exec(`
      INSERT INTO users (id, email) VALUES (1, 'a@heycapy.test');
      INSERT INTO buckets (id, user_id, name, notifications_rules, field_schema)
        VALUES (1, 1, 'Bills', '{}', '${statuses}');
      INSERT INTO templates (name, rules_json, field_schema_json) VALUES ('T', '{}', '${statuses}');
      INSERT INTO items (bucket_id, user_id, title, status, snoozed_until)
        VALUES (1, 1, 'rent', 'snoozed', 1773144000), (1, 1, 'gym', 'active', NULL);
    `);

    migrate(db, { migrationsFolder: MIGRATIONS });

    expect(sqlite.prepare("SELECT status, remind_not_before FROM items ORDER BY id").all()).toEqual(
      [
        { status: "on hold", remind_not_before: 1773144000 },
        { status: "active", remind_not_before: null },
      ]
    );
    const saved = [
      sqlite.prepare("SELECT field_schema AS s FROM buckets").get(),
      sqlite.prepare("SELECT field_schema_json AS s FROM templates").get(),
    ] as { s: string }[];
    for (const { s } of saved) {
      expect(
        (JSON.parse(s) as { statuses: { name: string }[] }).statuses.map((x) => x.name)
      ).toEqual(["active", "on hold"]);
    }
    sqlite.close();
  });

  it("keep an item's own reminder offset as a one-item list", () => {
    const journal = JSON.parse(
      readFileSync(path.join(MIGRATIONS, "meta/_journal.json"), "utf8")
    ) as Journal;
    const offsetsMigration = journal.entries.findIndex(
      (e) => e.tag === "0016_item_reminder_offsets"
    );
    const dbPath = path.join(mkdtempSync(path.join(tmpdir(), "heycapy-offsets-")), "db.sqlite");
    const sqlite = new Database(dbPath);
    const db = drizzle(sqlite);
    migrate(db, { migrationsFolder: migrationsUpTo(offsetsMigration) });

    sqlite.exec(`
      INSERT INTO users (id, email) VALUES (1, 'a@heycapy.test');
      INSERT INTO buckets (id, user_id, name) VALUES (1, 1, 'Bills');
      INSERT INTO items (bucket_id, user_id, title, notification_offset_mins)
        VALUES (1, 1, 'rent', 1440), (1, 1, 'gym', NULL), (1, 1, 'call', 0);
    `);

    migrate(db, { migrationsFolder: MIGRATIONS });

    expect(sqlite.prepare("SELECT reminder_offsets FROM items ORDER BY id").all()).toEqual([
      { reminder_offsets: "[1440]" },
      { reminder_offsets: null },
      { reminder_offsets: "[0]" },
    ]);
    const columns = sqlite.prepare("PRAGMA table_info(items)").all() as { name: string }[];
    expect(columns.map((c) => c.name)).not.toContain("notification_offset_mins");
    sqlite.close();
  });

  it("turn a bucket's single default reminder into a list", () => {
    const journal = JSON.parse(
      readFileSync(path.join(MIGRATIONS, "meta/_journal.json"), "utf8")
    ) as Journal;
    const listMigration = journal.entries.findIndex(
      (e) => e.tag === "0017_bucket_default_reminders"
    );
    const dbPath = path.join(mkdtempSync(path.join(tmpdir(), "heycapy-defaults-")), "db.sqlite");
    const sqlite = new Database(dbPath);
    const db = drizzle(sqlite);
    migrate(db, { migrationsFolder: migrationsUpTo(listMigration) });

    const template = JSON.stringify({ notifications: { defaultOffsetMins: 4320 }, items: {} });
    sqlite.exec(`
      INSERT INTO users (id, email) VALUES (1, 'a@heycapy.test');
      INSERT INTO buckets (user_id, name, notifications_rules) VALUES
        (1, 'Bills', '{"medium":["telegram"],"defaultOffsetMins":1440}'),
        (1, 'Todo', '{}'),
        (1, 'Old', '{"default_offset":"1 day"}'),
        (1, 'Broken', 'not json');
      INSERT INTO templates (name, rules_json) VALUES ('Subs', '${template}');
    `);

    migrate(db, { migrationsFolder: MIGRATIONS });

    const rules = sqlite
      .prepare("SELECT notifications_rules AS r FROM buckets ORDER BY id")
      .all() as { r: string }[];
    expect(rules.map((row) => row.r)).toEqual([
      '{"medium":["telegram"],"defaultReminders":[1440]}',
      '{"defaultReminders":[0]}',
      '{"defaultReminders":[0]}',
      "not json",
    ]);
    const saved = sqlite.prepare("SELECT rules_json AS r FROM templates").get() as { r: string };
    expect(JSON.parse(saved.r)).toEqual({ notifications: { defaultReminders: [4320] }, items: {} });
    sqlite.close();
  });
});

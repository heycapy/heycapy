import { expect, it } from "vitest";
import { readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { backupDatabase, databaseFilePath } from "@/lib/db";
import { seedUser } from "./helpers";

const backupDir = () => path.join(path.dirname(path.resolve(databaseFilePath())), "backups");

it("writes a readable copy of the database", async () => {
  await seedUser();

  const file = await backupDatabase(new Date("2026-03-10T03:40:00Z"));

  expect(path.basename(file)).toBe("heycapy-2026-03-10.db");
  expect(readdirSync(backupDir()).filter((f) => f.startsWith("heycapy-2026-03-10"))).toEqual([
    "heycapy-2026-03-10.db",
  ]);
  const copy = new Database(file, { readonly: true });
  const { n } = copy.prepare("SELECT count(*) AS n FROM users").get() as { n: number };
  copy.close();
  expect(n).toBeGreaterThan(0);
});

it("keeps only the newest seven", async () => {
  for (let day = 1; day <= 9; day++) {
    writeFileSync(path.join(backupDir(), `heycapy-2026-02-0${day}.db`), "");
  }

  await backupDatabase(new Date("2026-03-11T03:40:00Z"));

  const kept = readdirSync(backupDir()).sort();
  expect(kept).toHaveLength(7);
  expect(kept[kept.length - 1]).toBe("heycapy-2026-03-11.db");
  expect(kept).not.toContain("heycapy-2026-02-01.db");
});

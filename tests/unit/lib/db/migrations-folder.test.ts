import { afterAll, describe, it, expect } from "vitest";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { findMigrationsFolder } from "@/lib/db/migrations-folder";

const roots: string[] = [];
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function tempDir(...folders: string[]): string {
  const root = mkdtempSync(path.join(tmpdir(), "heycapy-migrations-folder-"));
  roots.push(root);
  for (const folder of folders) mkdirSync(path.join(root, folder), { recursive: true });
  return root;
}

describe("findMigrationsFolder", () => {
  it("uses the repo's migrations when running `pnpm dev` from the project root", () => {
    const root = tempDir("src/lib/db/migrations");
    expect(findMigrationsFolder(root)).toBe(path.join(root, "src/lib/db/migrations"));
  });

  it("prefers the migrations shipped next to the production server", () => {
    const root = tempDir("migrations", "src/lib/db/migrations");
    expect(findMigrationsFolder(root)).toBe(path.join(root, "migrations"));
  });

  it("returns null when there are no migrations", () => {
    expect(findMigrationsFolder(tempDir())).toBeNull();
  });
});

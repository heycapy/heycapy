import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, vi } from "vitest";

// Set before @/lib/db loads; one database per test file
const dir = mkdtempSync(path.join(tmpdir(), "heycapy-integration-"));
process.env.DATABASE_URL = `file:${path.join(dir, "test.db")}`;

// revalidatePath needs a Next request context
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { db } = await import("@/lib/db");
const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
migrate(db, { migrationsFolder: path.join(import.meta.dirname, "../../src/lib/db/migrations") });
afterAll(() => rmSync(dir, { recursive: true, force: true }));

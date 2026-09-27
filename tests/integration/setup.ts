import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { vi } from "vitest";

// Must be set before anything imports @/lib/db — each test file gets its own database
const dir = mkdtempSync(path.join(tmpdir(), "heycapy-integration-"));
process.env.DATABASE_URL = `file:${path.join(dir, "test.db")}`;

// Server actions and tools call revalidatePath, which only works inside a Next request
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { db } = await import("@/lib/db");
const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
migrate(db, { migrationsFolder: path.join(import.meta.dirname, "../../src/lib/db/migrations") });

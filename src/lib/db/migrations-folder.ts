import { existsSync } from "node:fs";
import path from "node:path";

// The production build ships migrations next to server.js; `pnpm dev` runs from the repo root
export function findMigrationsFolder(cwd = process.cwd()): string | null {
  const candidates = [path.join(cwd, "migrations"), path.join(cwd, "src/lib/db/migrations")];
  return candidates.find((dir) => existsSync(dir)) ?? null;
}

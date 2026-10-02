import { existsSync } from "node:fs";
import path from "node:path";

// Built server: ./migrations; `pnpm dev`: the repo folder
export function findMigrationsFolder(cwd = process.cwd()): string | null {
  const candidates = [path.join(cwd, "migrations"), path.join(cwd, "src/lib/db/migrations")];
  return candidates.find((dir) => existsSync(dir)) ?? null;
}

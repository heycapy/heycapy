export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { existsSync } = await import("fs");
    const { join } = await import("path");
    const migrationsFolder = join(process.cwd(), "migrations");
    if (!existsSync(migrationsFolder)) return;
    const { db } = await import("@/lib/db");
    const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
    migrate(db, { migrationsFolder });
  }
}

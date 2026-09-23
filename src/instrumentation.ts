export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { db } = await import("@/lib/db");
    const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
    const { join } = await import("path");
    migrate(db, { migrationsFolder: join(process.cwd(), "migrations") });
  }
}

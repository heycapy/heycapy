export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL is not set — point it at persistent storage, e.g. file:/data/heycapy.db"
      );
    }
    const { findMigrationsFolder } = await import("@/lib/db/migrations-folder");
    const migrationsFolder = findMigrationsFolder();
    if (migrationsFolder) {
      const { db } = await import("@/lib/db");
      const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
      migrate(db, { migrationsFolder });
    }
    const { startScheduler } = await import("@/lib/scheduler");
    startScheduler();
  }
}

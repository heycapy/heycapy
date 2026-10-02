export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL is not set — point it at persistent storage, e.g. file:/data/heycapy.db"
      );
    }
    const { isHosted } = await import("@/lib/credits");
    const { missingTierKeys } = await import("@/lib/ai/tiers");
    const missing = isHosted() ? missingTierKeys() : [];
    if (missing.length > 0) {
      throw new Error(
        `HOSTED is true but ${missing.join(", ")} is not set, which the models in src/lib/ai/tiers.ts need`
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

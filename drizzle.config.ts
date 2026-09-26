import type { Config } from "drizzle-kit";

const DATABASE_URL = process.env.DATABASE_URL ?? "file:heycapy.db";
const isPostgres = DATABASE_URL.startsWith("postgres");

export default {
  schema: isPostgres ? "./src/lib/db/schema.pg.ts" : "./src/lib/db/schema.ts",
  out: "./src/lib/db/migrations",
  dialect: isPostgres ? "postgresql" : "sqlite",
  dbCredentials: isPostgres ? { url: DATABASE_URL } : { url: DATABASE_URL.replace("file:", "") },
} satisfies Config;

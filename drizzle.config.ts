import type { Config } from "drizzle-kit";

const DATABASE_URL = process.env.DATABASE_URL ?? "file:heycapy.db";

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./src/lib/db/migrations",
  dialect: "sqlite",
  dbCredentials: { url: DATABASE_URL.replace("file:", "") },
} satisfies Config;

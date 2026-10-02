import { desc, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { systemErrors } from "@/lib/db/schema";
import { SYSTEM_ERRORS_KEPT_MS, SYSTEM_ERROR_MESSAGE_MAX } from "@/constants";
import { alertAdminsNow } from "@/lib/admin-alerts";

export type ErrorLevel = "critical" | "error" | "warning";
export type SystemError = typeof systemErrors.$inferSelect;

type RecordOptions = {
  level?: ErrorLevel;
  userId?: number | null;
  err?: unknown;
  context?: Record<string, unknown>;
  alert?: boolean;
};

function detailsOf(opts: RecordOptions): string {
  return JSON.stringify({
    stack: opts.err instanceof Error ? opts.err.stack : undefined,
    context: opts.context,
    runtime: {
      machine: process.env.FLY_MACHINE_ID ?? null,
      uptimeSec: Math.round(process.uptime()),
    },
  });
}

// Synchronous and never throws: it runs when something has already failed,
// sometimes right before the process exits. Also written to stderr.
export function recordSystemError(
  source: string,
  message: string,
  opts: RecordOptions = {}
): SystemError | null {
  const level = opts.level ?? "error";
  const stack = opts.err instanceof Error ? `\n${opts.err.stack}` : "";
  process.stderr.write(`[${source}] ${level}: ${message}${stack}\n`);
  let row: SystemError | null = null;
  try {
    row =
      db
        .insert(systemErrors)
        .values({
          level,
          source,
          message: message.slice(0, SYSTEM_ERROR_MESSAGE_MAX),
          details: detailsOf(opts),
          userId: opts.userId ?? null,
        })
        .returning()
        .get() ?? null;
  } catch {}
  if (row && level === "critical" && opts.alert !== false) void alertAdminsNow(row);
  return row;
}

export function recentSystemErrors(limit: number) {
  return db.select().from(systemErrors).orderBy(desc(systemErrors.id)).limit(limit);
}

export async function pruneSystemErrors(now = new Date()): Promise<void> {
  await db
    .delete(systemErrors)
    .where(lt(systemErrors.createdAt, new Date(now.getTime() - SYSTEM_ERRORS_KEPT_MS)));
}

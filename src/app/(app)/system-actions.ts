"use server";

import { and, count, eq, gte } from "drizzle-orm";
import type { ActionResult } from "@/types/result";
import { getSession } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import { notificationQueue } from "@/lib/db/schema";
import { schedulerHealth } from "@/lib/scheduler";
import { recentSystemErrors } from "@/lib/system-errors";
import { SYSTEM_ERRORS_SHOWN } from "@/constants";

export type SystemStatus = {
  scheduler: { started: boolean; lastRunAt: Date | null; stale: boolean };
  failedDeliveriesLastDay: number;
  errors: {
    id: number;
    level: string;
    source: string;
    message: string;
    details: string | null;
    userId: number | null;
    createdAt: Date;
  }[];
};

// Instance-wide health for the operators listed in ADMIN_EMAILS
export async function getSystemStatusAction(): Promise<ActionResult<{ status: SystemStatus }>> {
  const session = await getSession();
  if (!session || !isAdmin(session.email)) return { ok: false, error: "Not allowed" };

  const now = new Date();
  const [[failed], errors] = await Promise.all([
    db
      .select({ n: count() })
      .from(notificationQueue)
      .where(
        and(
          eq(notificationQueue.status, "dead"),
          gte(notificationQueue.createdAt, new Date(now.getTime() - 24 * 60 * 60 * 1000))
        )
      ),
    recentSystemErrors(SYSTEM_ERRORS_SHOWN),
  ]);

  return {
    ok: true,
    status: {
      scheduler: schedulerHealth(now),
      failedDeliveriesLastDay: failed?.n ?? 0,
      errors,
    },
  };
}

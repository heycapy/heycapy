"use server";

import { z } from "zod";
import { and, count, eq, gte, sql } from "drizzle-orm";
import type { ActionResult } from "@/types/result";
import { getSession } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import { notificationQueue, users } from "@/lib/db/schema";
import {
  adjustCredits,
  creditBalance,
  isHosted,
  recentCreditRows,
  type CreditRow,
} from "@/lib/credits";
import { schedulerHealth } from "@/lib/scheduler";
import { recentSystemErrors } from "@/lib/system-errors";
import {
  CREDITS_ADMIN_MAX_CHANGE,
  CREDITS_NOTE_MAX_LENGTH,
  CREDITS_ROWS_SHOWN,
  SYSTEM_ERRORS_SHOWN,
} from "@/constants";

export type SystemStatus = {
  hosted: boolean;
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
      hosted: isHosted(),
      scheduler: schedulerHealth(now),
      failedDeliveriesLastDay: failed?.n ?? 0,
      errors,
    },
  };
}

export type UserCredits = { email: string; balance: number; rows: CreditRow[] };

const creditChangeSchema = z.object({
  email: z.email("enter the user's email"),
  amount: z
    .int("amount must be a whole number")
    .refine((n) => n !== 0, "amount can't be 0")
    .refine(
      (n) => Math.abs(n) <= CREDITS_ADMIN_MAX_CHANGE,
      `at most ${CREDITS_ADMIN_MAX_CHANGE} at a time`
    ),
  note: z.string().trim().max(CREDITS_NOTE_MAX_LENGTH),
});

async function requireCreditsAdmin(): Promise<{ email: string } | { error: string }> {
  const session = await getSession();
  if (!session || !isAdmin(session.email)) return { error: "Not allowed" };
  if (!isHosted()) return { error: "credits are off on this server (HOSTED isn't true)" };
  return { email: session.email };
}

async function findUser(email: string) {
  return db.query.users.findFirst({
    where: eq(sql`lower(${users.email})`, email.trim().toLowerCase()),
  });
}

function creditsOf(user: { id: number; email: string }): UserCredits {
  return {
    email: user.email,
    balance: creditBalance(user.id),
    rows: recentCreditRows(user.id, CREDITS_ROWS_SHOWN),
  };
}

export async function getUserCreditsAction(
  email: string
): Promise<ActionResult<{ credits: UserCredits }>> {
  const admin = await requireCreditsAdmin();
  if ("error" in admin) return { ok: false, error: admin.error };
  const user = await findUser(email);
  if (!user) return { ok: false, error: "no user with that email" };
  return { ok: true, credits: creditsOf(user) };
}

// Positive gives credits, negative takes them back; never below zero
export async function adjustUserCreditsAction(input: {
  email: string;
  amount: number;
  note: string;
}): Promise<ActionResult<{ credits: UserCredits }>> {
  const admin = await requireCreditsAdmin();
  if ("error" in admin) return { ok: false, error: admin.error };
  const parsed = creditChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const user = await findUser(parsed.data.email);
  if (!user) return { ok: false, error: "no user with that email" };
  const result = adjustCredits(user.id, parsed.data.amount, parsed.data.note || null, admin.email);
  if (!result.ok) {
    return { ok: false, error: `they only have ${result.balance} credits to take` };
  }
  return { ok: true, credits: creditsOf(user) };
}

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
  creditTotals,
  creditsUsedSince,
  isHosted,
  recentCreditRows,
  type CreditRow,
  type CreditTotals,
} from "@/lib/credits";
import { schedulerHealth } from "@/lib/scheduler";
import { personChanged } from "@/lib/events";
import {
  adjustUsernameBonus,
  changeUsername,
  recentUsernameChanges,
  usernameAllowance,
  type UsernameAllowance,
  type UsernameChange,
} from "@/lib/account/username";
import { USERNAME_CHANGES_SHOWN, USERNAME_INPUT_MAX_LENGTH } from "@/lib/account/constants";
import { serverCostSince } from "@/lib/ai/usage";
import { recentSystemErrors } from "@/lib/system-errors";
import {
  CREDITS_ADMIN_MAX_CHANGE,
  CREDITS_NOTE_MAX_LENGTH,
  CREDITS_RECENT_DAYS,
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

export type UserCredits = {
  email: string;
  balance: number;
  totals: CreditTotals;
  rows: CreditRow[];
  recent: { creditsUsed: number; costMicros: number; unpricedCalls: number };
};

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

async function requireAdmin(): Promise<{ email: string } | { error: string }> {
  const session = await getSession();
  if (!session || !isAdmin(session.email)) return { error: "Not allowed" };
  return { email: session.email };
}

async function requireCreditsAdmin(): Promise<{ email: string } | { error: string }> {
  const admin = await requireAdmin();
  if ("error" in admin) return admin;
  if (!isHosted()) return { error: "credits are off on this server (HOSTED isn't true)" };
  return admin;
}

async function findUser(email: string) {
  return db.query.users.findFirst({
    where: eq(sql`lower(${users.email})`, email.trim().toLowerCase()),
  });
}

function creditsOf(user: { id: number; email: string }): UserCredits {
  const since = new Date(Date.now() - CREDITS_RECENT_DAYS * 24 * 60 * 60 * 1000);
  return {
    email: user.email,
    balance: creditBalance(user.id),
    totals: creditTotals(user.id),
    rows: recentCreditRows(user.id, CREDITS_ROWS_SHOWN),
    recent: {
      creditsUsed: creditsUsedSince(user.id, since),
      ...serverCostSince(user.id, since),
    },
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

// a positive amount gives credits and a negative one takes them back but never below zero
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

export type UserUsername = {
  email: string;
  username: string | null;
  allowance: UsernameAllowance;
  changes: UsernameChange[];
};

const UserEmail = z.email("enter the user's email");
const usernameRenameSchema = z.object({
  email: UserEmail,
  username: z.string().max(USERNAME_INPUT_MAX_LENGTH, "that username is too long"),
});
const usernameBonusSchema = z.object({
  email: UserEmail,
  delta: z.union([z.literal(1), z.literal(-1)]),
});

async function usernameOf(user: {
  id: number;
  email: string;
}): Promise<ActionResult<{ user: UserUsername }>> {
  const [row, allowance, changes] = await Promise.all([
    db.query.users.findFirst({ columns: { username: true }, where: eq(users.id, user.id) }),
    usernameAllowance(user.id),
    recentUsernameChanges(user.id, USERNAME_CHANGES_SHOWN),
  ]);
  if (!row || !allowance) return { ok: false, error: "no user with that email" };
  return { ok: true, user: { email: user.email, username: row.username, allowance, changes } };
}

export async function getUserUsernameAction(
  email: string
): Promise<ActionResult<{ user: UserUsername }>> {
  const admin = await requireAdmin();
  if ("error" in admin) return { ok: false, error: admin.error };
  const parsed = UserEmail.safeParse(email);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const user = await findUser(parsed.data);
  if (!user) return { ok: false, error: "no user with that email" };
  return usernameOf(user);
}

// Skips the person's monthly changes, bonus and the hold on old names, never the other rules
export async function renameUserAction(input: {
  email: string;
  username: string;
}): Promise<ActionResult<{ user: UserUsername }>> {
  const admin = await requireAdmin();
  if ("error" in admin) return { ok: false, error: admin.error };
  const parsed = usernameRenameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const user = await findUser(parsed.data.email);
  if (!user) return { ok: false, error: "no user with that email" };

  const result = await changeUsername(user.id, parsed.data.username, { byAdmin: true });
  if (!result.ok) {
    switch (result.reason) {
      case "invalid":
        return { ok: false, error: result.problem };
      case "taken":
        return { ok: false, error: "someone else has that username" };
      case "same":
        return { ok: false, error: "that's already their username" };
      case "limit":
        return { ok: false, error: "they have no username changes left" };
      case "not_found":
        return { ok: false, error: "no user with that email" };
    }
  }
  await personChanged(user.id);
  return usernameOf(user);
}

export async function adjustUsernameBonusAction(input: {
  email: string;
  delta: number;
}): Promise<ActionResult<{ user: UserUsername }>> {
  const admin = await requireAdmin();
  if ("error" in admin) return { ok: false, error: admin.error };
  const parsed = usernameBonusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "give or take one bonus change at a time" };
  const user = await findUser(parsed.data.email);
  if (!user) return { ok: false, error: "no user with that email" };

  if ((await adjustUsernameBonus(user.id, parsed.data.delta)) === null) {
    return { ok: false, error: "they have no bonus changes to take" };
  }
  return usernameOf(user);
}

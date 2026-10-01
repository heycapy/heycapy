import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db, type DB } from "@/lib/db";
import { creditLedger } from "@/lib/db/schema";
import { CREDITS_FREE_GRANT, CREDITS_PER_MESSAGE } from "@/constants";
import type { UsageMeta } from "@/lib/ai/usage";

type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export type CreditRow = typeof creditLedger.$inferSelect;

// self hosted servers keep no ledger since their ai key is free for their own users
export function isHosted(): boolean {
  return process.env.HOSTED === "true";
}

export function chargesCredits(meta: UsageMeta): boolean {
  return isHosted() && meta.key === "server";
}

function balanceIn(tx: Tx, userId: number): number {
  const row = tx
    .select({ total: sql<number>`coalesce(sum(${creditLedger.amount}), 0)` })
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId))
    .get();
  return row?.total ?? 0;
}

// free credits come with the first look at the ledger so older accounts get them too
function grantIfNew(tx: Tx, userId: number): void {
  const any = tx
    .select({ id: creditLedger.id })
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId))
    .limit(1)
    .get();
  if (!any) {
    tx.insert(creditLedger)
      .values({ userId, amount: CREDITS_FREE_GRANT, kind: "grant", note: "free credits" })
      .run();
  }
}

export function creditBalance(userId: number): number {
  return db.transaction((tx) => {
    grantIfNew(tx, userId);
    return balanceIn(tx, userId);
  });
}

// taken before the call so two messages at once cannot spend the same credit and null when too low
export function holdMessageCredit(userId: number): number | null {
  return db.transaction((tx) => {
    grantIfNew(tx, userId);
    if (balanceIn(tx, userId) < CREDITS_PER_MESSAGE) return null;
    const row = tx
      .insert(creditLedger)
      .values({ userId, amount: -CREDITS_PER_MESSAGE, kind: "message" })
      .returning({ id: creditLedger.id })
      .get();
    return row.id;
  });
}

export function refundMessageCredit(holdId: number): void {
  const hold = db.select().from(creditLedger).where(eq(creditLedger.id, holdId)).get();
  if (!hold || hold.kind !== "message") return;
  db.insert(creditLedger)
    .values({ userId: hold.userId, amount: -hold.amount, kind: "refund", refundOf: hold.id })
    .onConflictDoNothing()
    .run();
}

// refuses a change that would take the balance below zero
export function adjustCredits(
  userId: number,
  amount: number,
  note: string | null,
  actor: string
): { ok: true; balance: number } | { ok: false; balance: number } {
  return db.transaction((tx) => {
    grantIfNew(tx, userId);
    const balance = balanceIn(tx, userId);
    if (balance + amount < 0) return { ok: false, balance };
    tx.insert(creditLedger).values({ userId, amount, kind: "admin", note, actor }).run();
    return { ok: true, balance: balance + amount };
  });
}

export type CreditTotals = Record<CreditRow["kind"], number>;

export function creditTotals(userId: number): CreditTotals {
  const totals: CreditTotals = { grant: 0, purchase: 0, message: 0, refund: 0, admin: 0 };
  const rows = db
    .select({ kind: creditLedger.kind, total: sql<number>`sum(${creditLedger.amount})` })
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId))
    .groupBy(creditLedger.kind)
    .all();
  for (const row of rows) totals[row.kind] = row.total;
  return totals;
}

// answers charged minus the ones refunded
export function creditsUsedSince(userId: number, since: Date): number {
  const row = db
    .select({ total: sql<number>`coalesce(sum(${creditLedger.amount}), 0)` })
    .from(creditLedger)
    .where(
      and(
        eq(creditLedger.userId, userId),
        inArray(creditLedger.kind, ["message", "refund"]),
        gte(creditLedger.createdAt, since)
      )
    )
    .get();
  return -(row?.total ?? 0);
}

export function recentCreditRows(userId: number, limit: number): CreditRow[] {
  return db
    .select()
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId))
    .orderBy(desc(creditLedger.id))
    .limit(limit)
    .all();
}

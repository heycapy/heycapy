import { NextResponse } from "next/server";
import { like } from "drizzle-orm";
import { db } from "@/lib/db";
import { authRateLimits, otps, users } from "@/lib/db/schema";
import { deleteAccount } from "@/lib/account/delete";
import { isE2ETestMode } from "@/lib/e2e";

// Each run starts from fresh test accounts, so nothing a spec created piles up between runs
export async function POST() {
  if (!isE2ETestMode()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const testUsers = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(like(users.email, "%@heycapy.test"));
  for (const user of testUsers) deleteAccount(user.id, user.email);
  await db.delete(authRateLimits).where(like(authRateLimits.email, "%@heycapy.test"));
  await db.delete(otps).where(like(otps.email, "%@heycapy.test"));

  return NextResponse.json({ ok: true });
}

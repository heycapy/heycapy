import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRateLimits, otps } from "@/lib/db/schema";
import { like } from "drizzle-orm";
import { isE2ETestMode } from "@/lib/e2e";

export async function POST() {
  if (!isE2ETestMode()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.delete(authRateLimits).where(like(authRateLimits.email, "%@heycapy.test"));
  await db.delete(otps).where(like(otps.email, "%@heycapy.test"));

  return NextResponse.json({ ok: true });
}

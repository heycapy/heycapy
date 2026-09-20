import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    db.get(sql`SELECT 1`);
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    return NextResponse.json(
      { status: "error", reason: err instanceof Error ? err.message : "unknown" },
      { status: 503 }
    );
  }
}

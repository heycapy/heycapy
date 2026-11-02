import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { recordSystemError } from "@/lib/system-errors";

// Public, so the reason stays in the server log: a database error can name files and tables
export async function GET() {
  try {
    db.get(sql`SELECT 1`);
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown";
    recordSystemError("health", `database check failed: ${reason}`, { err });
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}

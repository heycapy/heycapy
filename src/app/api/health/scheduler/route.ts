import { NextResponse } from "next/server";
import { schedulerHealth } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

// For an uptime monitor, not the platform's routing check: a stuck scheduler must not take the site down
export function GET() {
  const health = schedulerHealth();
  return NextResponse.json(
    {
      status: health.stale ? "stale" : "ok",
      started: health.started,
      lastRunAt: health.lastRunAt?.toISOString() ?? null,
    },
    { status: health.stale ? 503 : 200 }
  );
}

import { NextResponse } from "next/server";
import { runNotifications } from "@/lib/scheduler";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  await runNotifications();
  return NextResponse.json({ ok: true });
}

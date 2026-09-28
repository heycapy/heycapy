import { requireApiSession } from "@/lib/auth/session";
import { buildAccountExport } from "@/lib/account/export";

export const dynamic = "force-dynamic";

export async function GET() {
  const [session, authErr] = await requireApiSession();
  if (authErr) return authErr;

  const now = new Date();
  const data = await buildAccountExport(session.userId, now);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="heycapy-export-${now.toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

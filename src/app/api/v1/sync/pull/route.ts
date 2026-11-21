import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiSession } from "@/lib/auth/session";
import { PULL_DEFAULT_LIMIT, PULL_MAX_LIMIT } from "@/constants";
import { pull } from "@/lib/sync/pull";
import { checkProtocol, syncVersions } from "@/lib/sync/version";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({
  cursor: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(PULL_MAX_LIMIT).default(PULL_DEFAULT_LIMIT),
});

export async function GET(request: Request) {
  const [session, authErr] = await requireApiSession();
  if (authErr) return authErr;
  const gate = checkProtocol(request);
  if (gate) return gate;

  const query = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  const result = pull(db, session.userId, query.data.cursor, query.data.limit);
  return Response.json({ ...syncVersions, ...result });
}

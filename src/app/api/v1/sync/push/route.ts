import { db } from "@/lib/db";
import { requireApiSession } from "@/lib/auth/session";
import { PUSH_MAX_BYTES } from "@/constants";
import { PushEnvelope } from "@/lib/sync/protocol";
import { applyPush } from "@/lib/sync/push";
import { checkProtocol } from "@/lib/sync/version";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const [session, authErr] = await requireApiSession();
  if (authErr) return authErr;
  const gate = checkProtocol(request);
  if (gate) return gate;

  const text = await request.text();
  if (text.length > PUSH_MAX_BYTES) return Response.json({ error: "Too large" }, { status: 413 });

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const envelope = PushEnvelope.safeParse(body);
  if (!envelope.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  const { deviceId, mutations } = envelope.data;
  if (mutations.some((m, i) => i > 0 && m.seq <= mutations[i - 1].seq)) {
    return Response.json({ error: "Changes must be in order" }, { status: 400 });
  }

  const results = applyPush(db, session.userId, deviceId, mutations);
  return Response.json({ results });
}

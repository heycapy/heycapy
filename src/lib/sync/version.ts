import {
  SYNC_MIN_PROTOCOL_VERSION,
  SYNC_PROTOCOL_HEADER,
  SYNC_PROTOCOL_VERSION,
  SYNC_SCHEMA_VERSION,
} from "@/constants";

export const syncVersions = { protocol: SYNC_PROTOCOL_VERSION, schema: SYNC_SCHEMA_VERSION };

// A client that doesn't say which protocol it speaks, or speaks one that is no longer served, gets
// no data: it would misread what it receives
export function checkProtocol(request: Request): Response | null {
  const value = request.headers.get(SYNC_PROTOCOL_HEADER);
  const version = value !== null && /^\d+$/.test(value) ? Number(value) : null;
  if (version === null)
    return Response.json({ error: "Protocol version missing" }, { status: 400 });
  if (version < SYNC_MIN_PROTOCOL_VERSION) {
    return Response.json(
      { error: "Update the app to keep syncing", minProtocol: SYNC_MIN_PROTOCOL_VERSION },
      { status: 426 }
    );
  }
  return null;
}

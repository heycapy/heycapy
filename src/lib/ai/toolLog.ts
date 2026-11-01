import type { ToolCall } from "./types";

const READ_ONLY_TOOLS = new Set([
  "list_buckets",
  "list_items",
  "search_items",
  "get_bucket_settings",
]);
const MAX_ERROR_LENGTH = 200;

function outcome(result: string): string {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(result) as Record<string, unknown>;
  } catch {
    return "failed";
  }
  if (parsed.needsConfirmation) return "nothing done yet, asked the user to confirm";
  if (parsed.ok !== true) return `failed: ${String(parsed.error ?? "").slice(0, MAX_ERROR_LENGTH)}`;
  if (parsed.itemId !== undefined) return `done, new item ${String(parsed.itemId)}`;
  if (parsed.bucketId !== undefined) return `done, new bucket ${String(parsed.bucketId)}`;
  if (parsed.newStatus !== undefined) return `done, now ${String(parsed.newStatus)}`;
  return "done";
}

// Only what changed or was asked: reads can be run again, and their results would fill the history
export function toolLogLine(call: ToolCall, result: string): string | null {
  if (READ_ONLY_TOOLS.has(call.name)) return null;
  return `- ${call.name} ${JSON.stringify(call.arguments ?? {})} → ${outcome(result)}`;
}

export function withToolLog(text: string, toolLog: string | null): string {
  return toolLog ? `<tools_used>\n${toolLog}\n</tools_used>\n${text}` : text;
}

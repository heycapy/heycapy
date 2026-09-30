import { db } from "@/lib/db";
import { aiUsage } from "@/lib/db/schema";
import { errorMessage } from "@/lib/errors";
import { recordSystemError } from "@/lib/system-errors";
import type { TokenUsage } from "./types";

// key: "own" when the user's own API key or Ollama server answered, "server" when ours did
export type UsageMeta = { provider: string; model: string; key: "own" | "server" };

type UsageRecord = {
  userId: number;
  sessionId: number | null;
  source: "web" | "telegram" | "summary";
  meta: UsageMeta;
  calls: TokenUsage[];
};

// Never throws: a failed write must not cost the user their answer
export function recordUsage({ userId, sessionId, source, meta, calls }: UsageRecord): void {
  if (calls.length === 0) return;
  try {
    db.insert(aiUsage)
      .values({
        userId,
        sessionId,
        source,
        ...meta,
        calls: calls.length,
        inputTokens: calls.reduce((sum, c) => sum + (c?.inputTokens ?? 0), 0),
        outputTokens: calls.reduce((sum, c) => sum + (c?.outputTokens ?? 0), 0),
        cacheReadTokens: calls.reduce((sum, c) => sum + (c?.cacheReadTokens ?? 0), 0),
        cacheWriteTokens: calls.reduce((sum, c) => sum + (c?.cacheWriteTokens ?? 0), 0),
        unreportedCalls: calls.filter((c) => c === null).length,
      })
      .run();
  } catch (err) {
    recordSystemError("ai-usage", `recording usage failed: ${errorMessage(err)}`, { userId, err });
  }
}

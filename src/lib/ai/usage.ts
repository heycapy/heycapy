import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiUsage } from "@/lib/db/schema";
import { errorMessage } from "@/lib/errors";
import { recordSystemError } from "@/lib/system-errors";
import { costMicros, type Price } from "./tiers";
import type { TokenUsage } from "./types";

// key: "own" when the user's own API key or Ollama server answered, "server" when ours did
// price: only when we know what our model costs, so hosted tiers
export type UsageMeta = {
  provider: string;
  model: string;
  key: "own" | "server";
  price?: Price;
};

type UsageRecord = {
  userId: number;
  sessionId: number | null;
  source: "web" | "telegram" | "summary" | "voice";
  meta: UsageMeta;
  calls: TokenUsage[];
};

// never throws: a failed write must not cost the user their answer
export function recordUsage({ userId, sessionId, source, meta, calls }: UsageRecord): void {
  if (calls.length === 0) return;
  const { provider, model, key, price } = meta;
  try {
    db.insert(aiUsage)
      .values({
        userId,
        sessionId,
        source,
        provider,
        model,
        key,
        calls: calls.length,
        inputTokens: calls.reduce((sum, c) => sum + (c?.inputTokens ?? 0), 0),
        outputTokens: calls.reduce((sum, c) => sum + (c?.outputTokens ?? 0), 0),
        cacheReadTokens: calls.reduce((sum, c) => sum + (c?.cacheReadTokens ?? 0), 0),
        cacheWriteTokens: calls.reduce((sum, c) => sum + (c?.cacheWriteTokens ?? 0), 0),
        unreportedCalls: calls.filter((c) => c === null).length,
        costMicros: key === "server" && price ? costMicros(price, calls) : null,
      })
      .run();
  } catch (err) {
    recordSystemError("ai-usage", `recording usage failed: ${errorMessage(err)}`, { userId, err });
  }
}

// what our key cost for this user, with the calls whose model had no price counted apart
export function serverCostSince(
  userId: number,
  since: Date
): { costMicros: number; unpricedCalls: number } {
  const row = db
    .select({
      cost: sql<number>`coalesce(sum(${aiUsage.costMicros}), 0)`,
      unpriced: sql<number>`coalesce(sum(case when ${aiUsage.costMicros} is null then ${aiUsage.calls} end), 0)`,
    })
    .from(aiUsage)
    .where(
      and(eq(aiUsage.userId, userId), eq(aiUsage.key, "server"), gte(aiUsage.createdAt, since))
    )
    .get();
  return { costMicros: row?.cost ?? 0, unpricedCalls: row?.unpriced ?? 0 };
}

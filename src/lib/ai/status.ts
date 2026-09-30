import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { creditBalance, isHosted } from "@/lib/credits";
import { parseProviderError } from "@/lib/errors";
import { hasOwnAI } from ".";
import type { UsageMeta } from "./usage";

export type AIStatus =
  | { kind: "credits"; balance: number }
  | {
      kind: "own";
      provider: string;
      status: "working" | "failed" | null;
      error: string | null;
      checkedAt: Date | null;
      credits: number | null;
    }
  | { kind: "server"; provider: string };

type SettingsRow = typeof userSettings.$inferSelect;

export function aiStatusFor(userId: number, settings: SettingsRow | undefined): AIStatus {
  const config = {
    provider: settings?.aiProvider,
    apiKey: settings?.aiApiKey,
    ollamaUrl: settings?.aiOllamaUrl,
    useOwnKey: settings?.aiUseOwnKey,
  };
  if (settings && hasOwnAI(config)) {
    return {
      kind: "own",
      provider: settings.aiProvider ?? "",
      status: settings.aiKeyStatus,
      error: settings.aiKeyError,
      checkedAt: settings.aiKeyCheckedAt,
      credits: isHosted() ? creditBalance(userId) : null,
    };
  }
  if (isHosted()) {
    return { kind: "credits", balance: creditBalance(userId) };
  }
  return {
    kind: "server",
    provider: settings?.aiProvider ?? process.env.AI_PROVIDER ?? "ollama",
  };
}

export async function getAIStatus(userId: number): Promise<AIStatus> {
  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
  });
  return aiStatusFor(userId, settings);
}

// Only the user's own key has a status to show; ours is watched through the system tab
export async function recordKeyResult(
  userId: number,
  meta: UsageMeta,
  err?: unknown
): Promise<void> {
  if (meta.key !== "own") return;
  await db
    .update(userSettings)
    .set({
      aiKeyStatus: err === undefined ? "working" : "failed",
      aiKeyError: err === undefined ? null : parseProviderError(err),
      aiKeyCheckedAt: new Date(),
    })
    .where(eq(userSettings.userId, userId));
}

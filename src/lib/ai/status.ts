import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { creditBalance, isHosted } from "@/lib/credits";
import { parseProviderError } from "@/lib/errors";
import { hasOwnAI, hasServerAI } from ".";
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
  | { kind: "server"; provider: string }
  | { kind: "none" };

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
  if (!hasServerAI()) return { kind: "none" };
  return {
    kind: "server",
    provider: process.env.AI_PROVIDER ?? "",
  };
}

export async function getAIStatus(userId: number): Promise<AIStatus> {
  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
  });
  return aiStatusFor(userId, settings);
}

// only the users own key has a status here since ours is watched in the system tab
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

"use server";

import { eq } from "drizzle-orm";
import type { ActionResult } from "@/types/result";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { decryptValue } from "@/lib/crypto";
import { getAIProvider, hasOwnAI } from "@/lib/ai";
import { aiStatusFor, getAIStatus, recordKeyResult, type AIStatus } from "@/lib/ai/status";
import { AI_KEY_CHECK_TIMEOUT_MS, AI_TIMEOUT_ERROR } from "@/constants";

export async function getAIStatusAction(): Promise<ActionResult<{ status: AIStatus }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };
  return { ok: true, status: await getAIStatus(session.userId) };
}

// One tiny call on the saved key, so a wrong key shows up before capy needs it
export async function checkAIKeyAction(): Promise<ActionResult<{ status: AIStatus }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };

  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, session.userId),
  });
  const config = {
    provider: settings?.aiProvider,
    model: settings?.aiModel,
    apiKey: settings?.aiApiKey ? decryptValue(settings.aiApiKey) : null,
    ollamaUrl: settings?.aiOllamaUrl,
    useOwnKey: settings?.aiUseOwnKey,
  };
  if (!settings || !hasOwnAI(config)) {
    return { ok: true, status: aiStatusFor(session.userId, settings) };
  }

  const provider = getAIProvider(config);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      provider.complete([{ role: "user", content: "Reply with OK." }], []),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(AI_TIMEOUT_ERROR)), AI_KEY_CHECK_TIMEOUT_MS);
      }),
    ]);
    await recordKeyResult(session.userId, provider.meta);
  } catch (err) {
    await recordKeyResult(session.userId, provider.meta, err);
  } finally {
    clearTimeout(timer);
  }
  return { ok: true, status: await getAIStatus(session.userId) };
}

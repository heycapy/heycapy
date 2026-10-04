import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type * as AIModule from "@/lib/ai";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { getUserSettingsAction, updateUserSettingsAction } from "@/app/(app)/user-settings-actions";
import { decryptValue, encryptValue } from "@/lib/crypto";
import {
  CUSTOM_PROMPT_MAX_LENGTH,
  CUSTOM_PROMPT_REJECTED_ERROR,
  CUSTOM_PROMPT_REQUIRED_ERROR,
} from "@/constants";
import { resetSchedulerEnvironment, seedUser, useSchedulerEnvironment } from "./helpers";

let session: { userId: number; email?: string } | null = null;
vi.mock("@/lib/auth/session", () => ({
  getSession: async () => session,
  deleteSession: async () => {},
}));

const review = vi.hoisted(() => ({ answer: "OK", fails: false, calls: 0 }));
vi.mock("@/lib/ai", async (importOriginal) => {
  const ai = await importOriginal<typeof AIModule>();
  return {
    ...ai,
    getAIProvider: () => ({
      chat: async () => ({ text: "", usage: null }),
      complete: async () => {
        review.calls++;
        if (review.fails) throw new Error("provider down");
        return { content: review.answer, toolCalls: [], usage: null };
      },
    }),
  };
});

beforeEach(() => {
  review.answer = "OK";
  review.fails = false;
  review.calls = 0;
});
beforeEach(() => useSchedulerEnvironment(new Date("2026-03-10T12:00:00Z")));
afterEach(() => resetSchedulerEnvironment());

const saved = {
  personalityName: "capy",
  personalityTone: "chill" as const,
  personalityEmoji: false,
  personalityCustomPrompt: null,
  timezone: "UTC",
  aiProvider: null,
  aiKeyEdits: {},
  aiOllamaUrl: null,
  aiUseOwnKey: true,
  aiCompactThreshold: 40,
  aiNotifyMessages: false,
  notificationsEmail: false,
  notificationEmailTo: null,
  notificationsPush: false,
  ntfyUrl: null,
  ntfyTopic: null,
  notificationsTelegram: true,
  transcriptionProvider: null,
  transcriptionKeyEdit: { newKey: null, clear: false },
  transcriptionModel: null,
  emailProvider: null,
  smtpHost: null,
  smtpPort: null,
  smtpUser: null,
  smtpPass: null,
  smtpSecure: false,
  smtpFrom: null,
  quietHoursFrom: null,
  quietHoursTo: null,
};

function typed(newKey: string | null, model: string | null = null) {
  return { newKey, clear: false, model };
}

async function row(userId: number) {
  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
  });
  if (!settings) throw new Error("no settings");
  return settings;
}

async function compactThreshold(userId: number) {
  const row = await db.query.userSettings.findFirst({ where: eq(userSettings.userId, userId) });
  return row?.aiCompactThreshold;
}

it.each([0, -5, 9, 501, 12.5, Number.NaN])(
  "refuses %s messages as the autocompact limit and keeps the old one",
  async (threshold) => {
    const userId = await seedUser();
    session = { userId };

    const result = await updateUserSettingsAction({ ...saved, aiCompactThreshold: threshold });

    expect(result).toEqual({
      ok: false,
      error: "Autocompact must be a whole number from 10 to 500",
    });
    expect(await compactThreshold(userId)).toBe(40);
  }
);

it.each([10, 120, 500])("saves %s messages as the autocompact limit", async (threshold) => {
  const userId = await seedUser();
  session = { userId };

  const result = await updateUserSettingsAction({ ...saved, aiCompactThreshold: threshold });

  expect(result).toEqual({ ok: true, aiChanged: false });
  expect(await compactThreshold(userId)).toBe(threshold);
});

it("a new AI key or server clears the old key's status until it's used or checked", async () => {
  const userId = await seedUser();
  session = { userId };
  await db
    .update(userSettings)
    .set({ aiKeyStatus: "failed", aiKeyError: "invalid key", aiKeyCheckedAt: new Date() })
    .where(eq(userSettings.userId, userId));

  expect(await updateUserSettingsAction(saved)).toEqual({ ok: true, aiChanged: false });
  expect(
    await updateUserSettingsAction({
      ...saved,
      aiProvider: "groq",
      aiKeyEdits: { groq: typed("new") },
    })
  ).toEqual({ ok: true, aiChanged: true });

  const row = await db.query.userSettings.findFirst({ where: eq(userSettings.userId, userId) });
  expect(row).toMatchObject({ aiKeyStatus: null, aiKeyError: null, aiKeyCheckedAt: null });
});

it("keeps a key and model per provider and never sends a saved key back", async () => {
  vi.stubEnv("ENCRYPTION_KEY", "ab".repeat(32));
  const userId = await seedUser();
  session = { userId, email: "capy@heycapy.test" };

  await updateUserSettingsAction({
    ...saved,
    aiProvider: "openai",
    aiKeyEdits: { openai: typed("sk-openai-key-1234", "gpt-4o-mini") },
  });
  await updateUserSettingsAction({
    ...saved,
    aiProvider: "groq",
    aiKeyEdits: { openai: typed(null, "gpt-4o-mini"), groq: typed("gsk-groq-key-5678") },
  });

  const loaded = await getUserSettingsAction();
  if (!loaded.ok) throw new Error(loaded.error);
  expect(loaded.aiKeys).toEqual({
    openai: { hasKey: true, keyEnding: "1234", model: "gpt-4o-mini" },
    groq: { hasKey: true, keyEnding: "5678", model: null },
  });
  expect(loaded.settings).toMatchObject({ aiProvider: "groq", aiApiKey: null, aiSavedKeys: null });
  expect(JSON.stringify(loaded)).not.toMatch(/sk-openai-key|gsk-groq-key/);

  const stored = await row(userId);
  expect(stored.aiApiKey && decryptValue(stored.aiApiKey)).toBe("gsk-groq-key-5678");
  expect(stored.aiSavedKeys).not.toMatch(/sk-openai-key|gsk-groq-key/);
  vi.unstubAllEnvs();
});

it("saving without retyping a key keeps it, and clearing removes it", async () => {
  const userId = await seedUser();
  session = { userId };
  const openai = (edit: { newKey: string | null; clear: boolean; model: string | null }) =>
    updateUserSettingsAction({ ...saved, aiProvider: "openai", aiKeyEdits: { openai: edit } });

  await openai(typed("sk-openai-key-1234", "gpt-4o"));
  await openai(typed(null, "gpt-4o"));
  expect(await row(userId)).toMatchObject({ aiApiKey: "sk-openai-key-1234", aiModel: "gpt-4o" });

  await openai({ newKey: null, clear: true, model: null });
  expect(await row(userId)).toMatchObject({ aiApiKey: null, aiModel: null, aiSavedKeys: null });
});

it("a key saved before keys were kept per provider shows as saved under its provider", async () => {
  const userId = await seedUser();
  session = { userId, email: "capy@heycapy.test" };
  await db
    .update(userSettings)
    .set({ aiProvider: "openai", aiApiKey: encryptValue("sk-old-key-abcd"), aiModel: "gpt-4o" })
    .where(eq(userSettings.userId, userId));

  const loaded = await getUserSettingsAction();
  if (!loaded.ok) throw new Error(loaded.error);
  expect(loaded.aiKeys).toEqual({ openai: { hasKey: true, keyEnding: "abcd", model: "gpt-4o" } });
});

it("the voice key is write-only too", async () => {
  const userId = await seedUser();
  session = { userId, email: "capy@heycapy.test" };
  const voice = (transcriptionKeyEdit: { newKey: string | null; clear: boolean }) =>
    updateUserSettingsAction({ ...saved, transcriptionProvider: "groq", transcriptionKeyEdit });

  await voice({ newKey: "gsk-voice-key-9999", clear: false });
  await voice({ newKey: null, clear: false });
  const loaded = await getUserSettingsAction();
  if (!loaded.ok) throw new Error(loaded.error);
  expect(loaded.transcriptionKey).toEqual({ hasKey: true, keyEnding: "9999" });
  expect(loaded.settings.transcriptionApiKey).toBeNull();

  await voice({ newKey: null, clear: true });
  expect((await row(userId)).transcriptionApiKey).toBeNull();
});

it("a short key shows as saved without its ending", async () => {
  const userId = await seedUser();
  session = { userId, email: "capy@heycapy.test" };
  await updateUserSettingsAction({
    ...saved,
    aiProvider: "groq",
    aiKeyEdits: { groq: typed("short") },
  });
  const loaded = await getUserSettingsAction();
  if (!loaded.ok) throw new Error(loaded.error);
  expect(loaded.aiKeys.groq).toEqual({ hasKey: true, keyEnding: null, model: null });
});

it("refuses a key that's too long", async () => {
  session = { userId: await seedUser() };
  expect(
    await updateUserSettingsAction({
      ...saved,
      aiKeyEdits: { openai: typed("x".repeat(501)) },
    })
  ).toEqual({ ok: false, error: "An AI key or model is too long" });
});

const pirate = {
  personalityTone: "custom" as const,
  personalityCustomPrompt: "  Talk like a pirate.  ",
};

it("refuses the custom tone without a prompt and keeps what was saved", async () => {
  const userId = await seedUser();
  session = { userId };

  for (const personalityCustomPrompt of [null, "", "   "]) {
    const result = await updateUserSettingsAction({
      ...saved,
      personalityName: "Zippy",
      personalityTone: "custom",
      personalityCustomPrompt,
    });
    expect(result).toEqual({ ok: false, error: CUSTOM_PROMPT_REQUIRED_ERROR });
  }
  expect((await row(userId)).personalityName).not.toBe("Zippy");
});

it("saves the name and a trimmed custom prompt without a review on a self-hosted server", async () => {
  const userId = await seedUser();
  session = { userId };

  const result = await updateUserSettingsAction({
    ...saved,
    personalityName: " Zippy ",
    ...pirate,
  });

  expect(result.ok).toBe(true);
  const settings = await row(userId);
  expect(settings.personalityName).toBe("Zippy");
  expect(settings.personalityCustomPrompt).toBe("Talk like a pirate.");
  expect(review.calls).toBe(0);
});

it("refuses a custom prompt that is too long", async () => {
  const userId = await seedUser();
  session = { userId };

  const result = await updateUserSettingsAction({
    ...saved,
    ...pirate,
    personalityCustomPrompt: "a".repeat(CUSTOM_PROMPT_MAX_LENGTH + 1),
  });

  expect(result).toEqual({ ok: false, error: "Custom prompt too long" });
});

it("on a hosted server a custom prompt the review rejects is refused and not saved", async () => {
  vi.stubEnv("HOSTED", "true");
  const userId = await seedUser();
  session = { userId };
  review.answer = "REJECT";

  const result = await updateUserSettingsAction({ ...saved, personalityName: "Zippy", ...pirate });

  expect(result).toEqual({ ok: false, error: CUSTOM_PROMPT_REJECTED_ERROR });
  const settings = await row(userId);
  expect(settings.personalityCustomPrompt).toBeNull();
  expect(settings.personalityName).not.toBe("Zippy");
  vi.unstubAllEnvs();
});

it("on a hosted server an accepted prompt is saved, and an unchanged one isn't reviewed again", async () => {
  vi.stubEnv("HOSTED", "true");
  const userId = await seedUser();
  session = { userId };

  expect((await updateUserSettingsAction({ ...saved, ...pirate })).ok).toBe(true);
  expect(review.calls).toBe(1);
  expect((await row(userId)).personalityCustomPrompt).toBe("Talk like a pirate.");

  review.answer = "REJECT";
  expect(
    (await updateUserSettingsAction({ ...saved, ...pirate, timezone: "Asia/Kolkata" })).ok
  ).toBe(true);
  expect(review.calls).toBe(1);
  vi.unstubAllEnvs();
});

it("on a hosted server a review that can't run lets the prompt through", async () => {
  vi.stubEnv("HOSTED", "true");
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  const userId = await seedUser();
  session = { userId };
  review.fails = true;

  expect((await updateUserSettingsAction({ ...saved, ...pirate })).ok).toBe(true);
  expect((await row(userId)).personalityCustomPrompt).toBe("Talk like a pirate.");
  vi.unstubAllEnvs();
});

it("doesn't review a prompt that isn't in use", async () => {
  vi.stubEnv("HOSTED", "true");
  const userId = await seedUser();
  session = { userId };
  review.answer = "REJECT";

  const result = await updateUserSettingsAction({
    ...saved,
    personalityTone: "chill",
    personalityCustomPrompt: "Talk like a pirate.",
  });

  expect(result.ok).toBe(true);
  expect(review.calls).toBe(0);
  vi.unstubAllEnvs();
});

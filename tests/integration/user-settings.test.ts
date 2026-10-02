import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { getUserSettingsAction, updateUserSettingsAction } from "@/app/(app)/user-settings-actions";
import { encryptValue } from "@/lib/crypto";
import { resetSchedulerEnvironment, seedUser, useSchedulerEnvironment } from "./helpers";

let session: { userId: number; email?: string } | null = null;
vi.mock("@/lib/auth/session", () => ({
  getSession: async () => session,
  deleteSession: async () => {},
}));

beforeEach(() => useSchedulerEnvironment(new Date("2026-03-10T12:00:00Z")));
afterEach(() => resetSchedulerEnvironment());

const saved = {
  personalityName: "capy",
  personalityTone: "chill" as const,
  personalityEmoji: false,
  personalityCustomPrompt: null,
  timezone: "UTC",
  aiProvider: null,
  aiApiKey: null,
  aiModel: null,
  aiSavedKeys: {},
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
  transcriptionApiKey: null,
  transcriptionModel: null,
  emailProvider: null,
  smtpHost: null,
  smtpPort: null,
  smtpUser: null,
  smtpPass: null,
  smtpSecure: false,
  smtpFrom: null,
};

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
  expect(await updateUserSettingsAction({ ...saved, aiProvider: "groq", aiApiKey: "new" })).toEqual(
    { ok: true, aiChanged: true }
  );

  const row = await db.query.userSettings.findFirst({ where: eq(userSettings.userId, userId) });
  expect(row).toMatchObject({ aiKeyStatus: null, aiKeyError: null, aiKeyCheckedAt: null });
});

it("keeps a key and model per provider, so switching back to one brings its key back", async () => {
  vi.stubEnv("ENCRYPTION_KEY", "ab".repeat(32));
  const userId = await seedUser();
  session = { userId, email: "capy@heycapy.test" };
  const openai = { apiKey: "sk-openai-key", model: "gpt-4o-mini" };

  await updateUserSettingsAction({
    ...saved,
    aiProvider: "openai",
    aiApiKey: openai.apiKey,
    aiModel: openai.model,
  });
  await updateUserSettingsAction({
    ...saved,
    aiProvider: "groq",
    aiApiKey: "gsk-groq-key",
    aiModel: null,
    aiSavedKeys: { openai },
  });

  const loaded = await getUserSettingsAction();
  if (!loaded.ok) throw new Error(loaded.error);
  expect(loaded.savedAIKeys).toEqual({
    openai,
    groq: { apiKey: "gsk-groq-key", model: null },
  });
  expect(loaded.settings).toMatchObject({
    aiProvider: "groq",
    aiApiKey: "gsk-groq-key",
    aiSavedKeys: null,
  });

  const row = await db.query.userSettings.findFirst({ where: eq(userSettings.userId, userId) });
  expect(row?.aiSavedKeys).not.toContain("sk-openai-key");
  vi.unstubAllEnvs();
});

it("a key saved before keys were kept per provider still shows under its provider", async () => {
  const userId = await seedUser();
  session = { userId, email: "capy@heycapy.test" };
  await db
    .update(userSettings)
    .set({ aiProvider: "openai", aiApiKey: encryptValue("sk-old-key"), aiModel: "gpt-4o" })
    .where(eq(userSettings.userId, userId));

  const loaded = await getUserSettingsAction();
  if (!loaded.ok) throw new Error(loaded.error);
  expect(loaded.savedAIKeys).toEqual({ openai: { apiKey: "sk-old-key", model: "gpt-4o" } });
});

it("refuses a saved key that's too long", async () => {
  session = { userId: await seedUser() };
  expect(
    await updateUserSettingsAction({
      ...saved,
      aiSavedKeys: { openai: { apiKey: "x".repeat(501), model: null } },
    })
  ).toEqual({ ok: false, error: "An AI key or model is too long" });
});

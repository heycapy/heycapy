import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { updateUserSettingsAction } from "@/app/(app)/user-settings-actions";
import { resetSchedulerEnvironment, seedUser, useSchedulerEnvironment } from "./helpers";

let session: { userId: number } | null = null;
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

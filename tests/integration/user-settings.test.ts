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

  expect(result).toEqual({ ok: true });
  expect(await compactThreshold(userId)).toBe(threshold);
});

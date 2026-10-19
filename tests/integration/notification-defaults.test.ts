import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, pushSubscriptions, templates, userSettings } from "@/lib/db/schema";
import { createBucketAction } from "@/app/(app)/bucket-actions";
import { joinBucketAction, createInviteAction } from "@/app/(app)/member-actions";
import { removePushDeviceAction, savePushDeviceAction } from "@/app/(app)/push-actions";
import {
  disconnectTelegramAction,
  updateUserSettingsAction,
} from "@/app/(app)/user-settings-actions";
import { executeToolCall } from "@/lib/ai/capyTools";
import { saveBucketSettings, saveMemberChannels } from "@/lib/buckets/settings";
import { parseNotificationDefaults } from "@/lib/buckets/follow";
import { getMemberChannels } from "@/lib/notifications/channels";
import { createTelegramLinkCode } from "@/lib/notifications/telegram-link";
import { parseNotificationRules } from "@/lib/rules";
import type { NotificationDefaults } from "@/types/rules";
import {
  HOUR,
  reminderOf,
  resetSchedulerEnvironment,
  seedBucket,
  seedItem,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";
import { say } from "./telegram-helpers";

const session = vi.hoisted(() => ({ userId: 0, email: "" }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => session }));

const T0 = new Date("2026-03-10T12:00:00Z");
const DEADLINE = new Date("2026-03-20T12:00:00Z");
const DAY = 24 * HOUR;

beforeEach(() => useSchedulerEnvironment(T0));
afterEach(() => resetSchedulerEnvironment());

async function signIn(): Promise<number> {
  session.userId = await seedUser();
  return session.userId;
}

// The defaults are saved with the rest of tweaks, so they go through the same save
async function saveDefaults(changes: Partial<NotificationDefaults>) {
  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, session.userId),
  });
  if (!settings) throw new Error("no settings");
  return updateUserSettingsAction({
    ...settings,
    aiKeyEdits: {},
    transcriptionKeyEdit: { newKey: null, clear: false },
    smtpPass: null,
    notificationDefaults: {
      ...parseNotificationDefaults(settings.notificationDefaults),
      ...changes,
    },
  });
}

async function seedTemplate(notifications: Record<string, unknown>, fieldSchema?: object) {
  const [template] = await db
    .insert(templates)
    .values({
      name: `Template ${Math.random()}`,
      rulesJson: JSON.stringify({ notifications, items: {} }),
      fieldSchemaJson: fieldSchema ? JSON.stringify(fieldSchema) : null,
      isBuiltin: true,
    })
    .returning();
  return template.id;
}

async function newBucket(notifications: Record<string, unknown> = {}, fieldSchema?: object) {
  const result = await createBucketAction(
    await seedTemplate(notifications, fieldSchema),
    `Bucket ${Math.random()}`
  );
  if (!result.ok) throw new Error(result.error);
  return result.bucketId;
}

async function stored(bucketId: number) {
  const bucket = await db.query.buckets.findFirst({ where: eq(buckets.id, bucketId) });
  if (!bucket) throw new Error("no bucket");
  return {
    rules: parseNotificationRules(bucket.notificationsRules),
    fieldSchema: bucket.fieldSchema
      ? (JSON.parse(bucket.fieldSchema as unknown as string) as Record<string, unknown>)
      : null,
  };
}

function settingsInput(overrides: { repeat?: "once" | "daily"; defaultReminders?: number[] }) {
  return {
    name: `Bucket ${Math.random()}`,
    itemsRules: {},
    notificationsRules: { defaultReminders: [0], repeat: "once" as const, ...overrides },
  };
}

describe("a new bucket", () => {
  it("follows tweaks for every setting, its channels included", async () => {
    const userId = await signIn();
    await saveDefaults({ defaultReminders: [DAY / 60_000], repeat: "daily", medium: ["email"] });

    const bucketId = await newBucket();
    const { rules } = await stored(bucketId);
    expect(rules).toMatchObject({
      defaultReminders: [1440],
      repeat: "daily",
      followsTweaks: ["defaultReminders", "notifyAt", "repeat", "overdue"],
    });
    expect(await getMemberChannels(userId, bucketId)).toEqual({
      medium: ["email"],
      webhooks: [],
      followsTweaks: true,
    });
  });

  it("keeps what its template sets as its own and follows tweaks for the rest", async () => {
    await signIn();
    const bucketId = await newBucket(
      { defaultReminders: [4320], notifyAt: "09:00" },
      { fields: [], notifyWhenOverdue: true }
    );
    expect((await stored(bucketId)).rules.followsTweaks).toEqual(["repeat"]);

    await saveDefaults({ defaultReminders: [60], notifyAt: "18:00", notifyWhenOverdue: false });
    const { rules, fieldSchema } = await stored(bucketId);
    expect(rules).toMatchObject({ defaultReminders: [4320], notifyAt: "09:00" });
    expect(fieldSchema).toMatchObject({ notifyWhenOverdue: true });
  });

  it("made by capy doesn't get a field schema when overdue alerts are off", async () => {
    const userId = await signIn();
    const result = JSON.parse(
      await executeToolCall(
        { id: "c", name: "create_bucket", arguments: { name: `AI ${Math.random()}` } },
        userId
      )
    ) as { bucketId: number };
    expect((await stored(result.bucketId)).fieldSchema).toBeNull();
  });
});

describe("saving tweaks", () => {
  it("moves the reminders of buckets that follow it and leaves buckets from before alone", async () => {
    const userId = await signIn();
    const following = await newBucket();
    const before = await seedBucket(userId, { medium: ["telegram"], repeat: "once" });
    const followingItem = await seedItem(userId, following, { deadline: DEADLINE });
    const beforeItem = await seedItem(userId, before, { deadline: DEADLINE });

    expect(await saveDefaults({ defaultReminders: [1440] })).toMatchObject({ ok: true });

    expect((await reminderOf(followingItem)).nextReminderAt).toEqual(
      new Date(DEADLINE.getTime() - DAY)
    );
    expect((await reminderOf(beforeItem)).nextReminderAt).toEqual(DEADLINE);
    expect((await stored(before)).rules).toMatchObject({
      defaultReminders: [0],
      followsTweaks: [],
    });
  });

  it("turns on overdue alerts in buckets that follow it", async () => {
    await signIn();
    const bucketId = await newBucket({}, { fields: [] });

    await saveDefaults({
      notifyWhenOverdue: true,
      overdueFirstAlertMins: 30,
      overdueRepeatHours: 2,
    });
    expect((await stored(bucketId)).fieldSchema).toMatchObject({
      notifyWhenOverdue: true,
      overdueFirstAlertMins: 30,
      overdueRepeatHours: 2,
    });

    await saveDefaults({ notifyWhenOverdue: false });
    expect((await stored(bucketId)).fieldSchema).toEqual({ fields: [], notifyWhenOverdue: false });
  });

  it("changes channels that follow it, not ones picked in the bucket", async () => {
    const userId = await signIn();
    const following = await newBucket();
    const picked = await newBucket();
    await saveMemberChannels(userId, picked, { medium: ["push"], webhooks: [] });

    await saveDefaults({ medium: ["email", "telegram"] });
    expect((await getMemberChannels(userId, following)).medium).toEqual(["email", "telegram"]);
    expect(await getMemberChannels(userId, picked)).toEqual({
      medium: ["push"],
      webhooks: [],
      followsTweaks: false,
    });
  });

  it("refuses a remind at time that doesn't exist", async () => {
    await signIn();
    expect(await saveDefaults({ notifyAt: "25:00" })).toEqual({
      ok: false,
      error: "Invalid bucket defaults",
    });
  });
});

describe("bucket settings", () => {
  it("stop following for only the setting changed when the save doesn't say (capy)", async () => {
    const userId = await signIn();
    const bucketId = await newBucket();

    await saveBucketSettings(userId, bucketId, settingsInput({ repeat: "daily" }));
    expect((await stored(bucketId)).rules.followsTweaks).toEqual([
      "defaultReminders",
      "notifyAt",
      "overdue",
    ]);
  });

  it("use tweaks puts a setting back on the defaults, whatever value was sent", async () => {
    const userId = await signIn();
    await saveDefaults({ defaultReminders: [60] });
    const bucketId = await seedBucket(userId, { medium: ["telegram"], defaultReminders: [0] });

    await saveBucketSettings(userId, bucketId, {
      ...settingsInput({ defaultReminders: [0] }),
      followsTweaks: ["defaultReminders"],
    });
    expect((await stored(bucketId)).rules).toMatchObject({
      defaultReminders: [60],
      followsTweaks: ["defaultReminders"],
    });
  });
});

describe("my channels in a bucket", () => {
  it("saved as following tweaks are the defaults, even when the list sent is out of date", async () => {
    const userId = await signIn();
    await saveDefaults({ medium: ["email"] });
    const bucketId = await seedBucket(userId, { medium: ["push"] });

    await saveMemberChannels(userId, bucketId, {
      medium: ["push"],
      webhooks: [],
      followsTweaks: true,
    });
    expect(await getMemberChannels(userId, bucketId)).toEqual({
      medium: ["email"],
      webhooks: [],
      followsTweaks: true,
    });
  });
});

describe("someone joining a shared bucket", () => {
  it("gets their own default channels, and they follow their own tweaks", async () => {
    const owner = await signIn();
    const bucketId = await seedBucket(owner, { medium: ["telegram"], repeat: "once" });
    const invite = await createInviteAction(bucketId);
    if (!invite.ok) throw new Error(invite.error);

    const friend = await signIn();
    await saveDefaults({ medium: ["email"] });
    await joinBucketAction(invite.code);
    expect(await getMemberChannels(friend, bucketId)).toEqual({
      medium: ["email"],
      webhooks: [],
      followsTweaks: true,
    });

    await saveDefaults({ medium: ["telegram"] });
    expect((await getMemberChannels(friend, bucketId)).medium).toEqual(["telegram"]);
    expect((await getMemberChannels(owner, bucketId)).medium).toEqual(["telegram"]);
  });
});

describe("a channel set up later", () => {
  async function withoutChannels(): Promise<number> {
    const userId = await signIn();
    await db
      .update(userSettings)
      .set({ telegramChatId: null, notificationsTelegram: false })
      .where(eq(userSettings.userId, userId));
    return userId;
  }

  it("reaches buckets that follow tweaks once telegram connects, and leaves when it disconnects", async () => {
    const userId = await withoutChannels();
    const following = await newBucket();
    const picked = await newBucket();
    await saveMemberChannels(userId, picked, { medium: [], webhooks: [], followsTweaks: false });

    await say(`/start ${await createTelegramLinkCode(userId, T0)}`, 7001);
    expect((await getMemberChannels(userId, following)).medium).toContain("telegram");
    expect((await getMemberChannels(userId, picked)).medium).toEqual([]);

    await disconnectTelegramAction();
    expect((await getMemberChannels(userId, following)).medium).not.toContain("telegram");
  });

  it("reaches buckets that follow tweaks once push is on, and leaves when the device is removed", async () => {
    const userId = await withoutChannels();
    const following = await newBucket();

    await savePushDeviceAction(
      {
        endpoint: "https://fcm.googleapis.com/fcm/send/defaults",
        keys: {
          p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQt",
          auth: "tBHItJI5svbpez7KI4CCXg",
        },
      },
      "Chrome on Linux"
    );
    expect((await getMemberChannels(userId, following)).medium).toContain("push");

    const [device] = await db
      .select({ id: pushSubscriptions.id })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
    await removePushDeviceAction(device.id);
    expect((await getMemberChannels(userId, following)).medium).not.toContain("push");
  });
});

describe("capy reading bucket settings", () => {
  async function settingsFor(userId: number, bucketId: number) {
    const result = JSON.parse(
      await executeToolCall(
        { id: "g", name: "get_bucket_settings", arguments: { bucket_id: bucketId } },
        userId
      )
    ) as { settings: { from_tweaks: string[] } };
    return result.settings;
  }

  it("sees which settings follow tweaks, and that one it changes no longer does", async () => {
    const userId = await signIn();
    const bucketId = await newBucket();
    expect((await settingsFor(userId, bucketId)).from_tweaks).toEqual([
      "channels",
      "default_reminders_mins",
      "remind_at",
      "deadline_repeat",
      "notify_when_overdue",
      "overdue_first_alert_mins",
      "overdue_repeat_hours",
    ]);

    await executeToolCall(
      {
        id: "u",
        name: "update_bucket_settings",
        arguments: { bucket_id: bucketId, remind_at: "08:00" },
      },
      userId
    );
    expect((await settingsFor(userId, bucketId)).from_tweaks).not.toContain("remind_at");
    expect((await settingsFor(userId, bucketId)).from_tweaks).toContain("deadline_repeat");
  });

  it("sees only a member's own channels following their tweaks, not the owner's rules", async () => {
    const owner = await signIn();
    const bucketId = await newBucket();
    const invite = await createInviteAction(bucketId);
    if (!invite.ok) throw new Error(invite.error);

    const member = await signIn();
    await joinBucketAction(invite.code);
    expect((await settingsFor(member, bucketId)).from_tweaks).toEqual(["channels"]);
    expect((await settingsFor(owner, bucketId)).from_tweaks).toContain("remind_at");
  });

  async function update(userId: number, args: Record<string, unknown>) {
    return JSON.parse(
      await executeToolCall({ id: "u", name: "update_bucket_settings", arguments: args }, userId)
    ) as {
      ok: boolean;
      error?: string;
      settings?: Record<string, unknown> & { from_tweaks: string[] };
    };
  }

  it("puts settings back on tweaks with use_tweaks, the overdue ones together", async () => {
    const userId = await signIn();
    await saveDefaults({ notifyAt: "18:00", medium: ["email"] });
    const bucketId = await newBucket();
    await update(userId, {
      bucket_id: bucketId,
      remind_at: "08:00",
      channels: ["push"],
      notify_when_overdue: true,
    });
    expect((await settingsFor(userId, bucketId)).from_tweaks).toEqual([
      "default_reminders_mins",
      "deadline_repeat",
    ]);

    const result = await update(userId, {
      bucket_id: bucketId,
      use_tweaks: ["remind_at", "channels", "overdue_repeat_hours"],
    });
    expect(result.settings).toMatchObject({
      remind_at: "18:00",
      channels: ["email"],
      notify_when_overdue: false,
    });
    expect(result.settings?.from_tweaks).toHaveLength(7);
  });

  it("lets a member put only their own channels back on tweaks", async () => {
    await signIn();
    const bucketId = await newBucket();
    const invite = await createInviteAction(bucketId);
    if (!invite.ok) throw new Error(invite.error);
    const member = await signIn();
    await saveDefaults({ medium: ["email"] });
    await joinBucketAction(invite.code);
    await update(member, { bucket_id: bucketId, channels: ["push"] });

    expect(await update(member, { bucket_id: bucketId, use_tweaks: ["remind_at"] })).toMatchObject({
      ok: false,
    });
    const result = await update(member, { bucket_id: bucketId, use_tweaks: ["channels"] });
    expect(result.settings).toMatchObject({ channels: ["email"], from_tweaks: ["channels"] });
  });

  it("refuses a setting that can't follow tweaks", async () => {
    const userId = await signIn();
    const bucketId = await newBucket();
    expect(await update(userId, { bucket_id: bucketId, use_tweaks: ["sort_by"] })).toEqual({
      ok: false,
      error: "use_tweaks can't take: sort_by",
    });
  });
});

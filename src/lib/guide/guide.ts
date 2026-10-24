import { and, eq, gt, isNotNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  bucketInvites,
  buckets,
  chatMessages,
  guideTasks,
  items,
  pushSubscriptions,
  userSettings,
  usernameChanges,
  users,
} from "@/lib/db/schema";
import { guideRewards, isHosted, rewardGuideTask } from "@/lib/credits";
import { CAPY_DEFAULT_NAME, CAPY_DEFAULT_TONE, GUIDE_TASKS, type GuideTaskKey } from "./constants";

export type GuideTask = {
  key: GuideTaskKey;
  title: string;
  hint: string;
  credits: number;
  done: boolean;
  earned: number;
};

// a self-hosted server keeps no ledger, so it pays no credits
export type GuideState = {
  tasks: GuideTask[];
  paysCredits: boolean;
  hidden: boolean;
};

async function exists(rows: Promise<unknown[]>): Promise<boolean> {
  return (await rows).length > 0;
}

function ownItem(userId: number, ...conditions: Parameters<typeof and>) {
  return exists(
    db
      .select({ id: items.id })
      .from(items)
      .where(and(eq(items.userId, userId), ...conditions))
      .limit(1)
  );
}

function settingSet(userId: number, ...conditions: Parameters<typeof and>) {
  return exists(
    db
      .select({ id: userSettings.id })
      .from(userSettings)
      .where(and(eq(userSettings.userId, userId), ...conditions))
  );
}

// Looks at what exists, so a task done anywhere (web, telegram, capy) counts. "marked" tasks have no
// check and are marked where they happen: smtp (a saved server proves nothing, only a test email
// that went out does) and theme (it's kept in the browser, the server never sees it)
const TASK_DONE: Record<GuideTaskKey, ((userId: number) => Promise<boolean>) | "marked"> = {
  add_item: (userId) => ownItem(userId),
  add_date: (userId) => ownItem(userId, isNotNull(items.deadline)),
  complete_item: (userId) => ownItem(userId, isNotNull(items.completedAt)),
  reminder_time: (userId) => ownItem(userId, isNotNull(items.reminderOffsets)),
  repeat_item: (userId) => ownItem(userId, isNotNull(items.recurring)),
  quiet_hours: (userId) => settingSet(userId, isNotNull(userSettings.quietHoursFrom)),
  own_bucket: (userId) =>
    exists(
      db
        .select({ id: buckets.id })
        .from(buckets)
        .innerJoin(users, eq(users.id, buckets.userId))
        .where(and(eq(buckets.userId, userId), gt(buckets.createdAt, users.createdAt)))
        .limit(1)
    ),
  share_bucket: (userId) =>
    exists(
      db
        .select({ id: bucketInvites.id })
        .from(bucketInvites)
        .where(eq(bucketInvites.createdBy, userId))
        .limit(1)
    ),
  username: (userId) =>
    exists(
      db
        .select({ id: usernameChanges.id })
        .from(usernameChanges)
        .where(and(eq(usernameChanges.userId, userId), eq(usernameChanges.byAdmin, false)))
        .limit(1)
    ),
  avatar: (userId) =>
    exists(
      db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, userId), isNotNull(users.avatar)))
    ),
  rename_capy: (userId) =>
    settingSet(userId, ne(sql`lower(${userSettings.personalityName})`, CAPY_DEFAULT_NAME)),
  capy_tone: (userId) => settingSet(userId, ne(userSettings.personalityTone, CAPY_DEFAULT_TONE)),
  ask_capy: (userId) =>
    exists(
      db
        .select({ id: chatMessages.id })
        .from(chatMessages)
        .where(and(eq(chatMessages.userId, userId), eq(chatMessages.role, "user")))
        .limit(1)
    ),
  push: (userId) =>
    exists(
      db
        .select({ id: pushSubscriptions.id })
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, userId))
        .limit(1)
    ),
  ntfy: (userId) => settingSet(userId, isNotNull(userSettings.ntfyTopic)),
  telegram: (userId) => settingSet(userId, isNotNull(userSettings.telegramChatId)),
  theme: "marked",
  smtp: "marked",
};

function availableTasks() {
  return GUIDE_TASKS.filter((task) => !("needs" in task) || !!process.env[task.needs]);
}

// The row is kept once, so the reward is paid once even if the task is undone and done again
export async function markGuideTaskDone(userId: number, task: GuideTaskKey): Promise<number> {
  return db.transaction((tx) => {
    const row = tx
      .insert(guideTasks)
      .values({ userId, task })
      .onConflictDoNothing()
      .returning({ id: guideTasks.id })
      .get();
    if (!row || !isHosted()) return 0;
    const credits = GUIDE_TASKS.find((t) => t.key === task)?.credits ?? 0;
    return rewardGuideTask(tx, userId, task, credits);
  });
}

export async function syncGuide(userId: number): Promise<GuideState> {
  const doneRows = await db
    .select({ task: guideTasks.task })
    .from(guideTasks)
    .where(eq(guideTasks.userId, userId));
  const done = new Set<string>(doneRows.map((row) => row.task));

  for (const task of availableTasks()) {
    if (done.has(task.key)) continue;
    const check = TASK_DONE[task.key];
    if (check === "marked" || !(await check(userId))) continue;
    await markGuideTaskDone(userId, task.key);
    done.add(task.key);
  }

  const user = await db.query.users.findFirst({
    columns: { guideHidden: true },
    where: eq(users.id, userId),
  });
  const earned = isHosted() ? guideRewards(userId) : new Map<string, number>();
  return {
    tasks: availableTasks().map((task) => ({
      key: task.key,
      title: task.title,
      hint: task.hint,
      credits: task.credits,
      done: done.has(task.key),
      earned: earned.get(task.key) ?? 0,
    })),
    paysCredits: isHosted(),
    hidden: user?.guideHidden ?? false,
  };
}

export async function setGuideHidden(userId: number, hidden: boolean): Promise<void> {
  await db.update(users).set({ guideHidden: hidden }).where(eq(users.id, userId));
}

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { executeToolCall } from "@/lib/ai/capyTools";
import { updateItemDeadline } from "@/app/api/telegram/telegram-utils";
import {
  HOUR,
  remindersQueued,
  resetSchedulerEnvironment,
  runSchedulerAt,
  seedReminder,
  useSchedulerEnvironment,
} from "./helpers";

const T0 = new Date("2026-03-10T12:00:00Z");

beforeEach(() => useSchedulerEnvironment(T0));
afterEach(() => resetSchedulerEnvironment());

describe("scheduler baseline", () => {
  it("reminds about an item whose deadline has arrived", async () => {
    const { itemId } = await seedReminder({ deadline: T0 });
    await runSchedulerAt(new Date(T0.getTime() + 60_000));
    expect(await remindersQueued(itemId)).toBe(1);
  });

  it("does not remind twice for a 'once' reminder", async () => {
    const { itemId } = await seedReminder({ deadline: T0 });
    await runSchedulerAt(new Date(T0.getTime() + 60_000));
    await runSchedulerAt(new Date(T0.getTime() + 2 * HOUR));
    expect(await remindersQueued(itemId)).toBe(1);
  });
});

describe("rescheduling from telegram", () => {
  it("re-arms the reminder for the new deadline", async () => {
    const { userId, itemId } = await seedReminder({ deadline: T0 });
    await runSchedulerAt(new Date(T0.getTime() + 60_000));
    expect(await remindersQueued(itemId)).toBe(1);

    const newDeadline = new Date(T0.getTime() + 24 * HOUR);
    await updateItemDeadline(userId, itemId, newDeadline);

    await runSchedulerAt(new Date(T0.getTime() + 2 * HOUR));
    expect(await remindersQueued(itemId)).toBe(1);

    await runSchedulerAt(new Date(newDeadline.getTime() + 60_000));
    expect(await remindersQueued(itemId)).toBe(2);
  });

  it("re-arms the overdue alert as well", async () => {
    const { userId, itemId } = await seedReminder({ deadline: T0 });
    await db
      .update(items)
      .set({ overdueNotifiedAt: new Date(T0.getTime() + HOUR) })
      .where(eq(items.id, itemId));

    await updateItemDeadline(userId, itemId, new Date(T0.getTime() + 24 * HOUR));

    const item = await db.query.items.findFirst({ where: eq(items.id, itemId) });
    expect(item?.overdueNotifiedAt).toBeNull();
  });

  it("does not re-fire immediately when moved to another past time", async () => {
    const { userId, itemId } = await seedReminder({ deadline: T0 });
    await runSchedulerAt(new Date(T0.getTime() + 2 * HOUR));
    expect(await remindersQueued(itemId)).toBe(1);

    await updateItemDeadline(userId, itemId, new Date(T0.getTime() + HOUR));
    await runSchedulerAt(new Date(T0.getTime() + 3 * HOUR));
    expect(await remindersQueued(itemId)).toBe(1);
  });
});

describe("snoozing via the assistant", () => {
  it("reminds again once the snooze ends, and not during it", async () => {
    const { userId, itemId } = await seedReminder({ deadline: T0 });
    await runSchedulerAt(new Date(T0.getTime() + 60_000));
    expect(await remindersQueued(itemId)).toBe(1);

    const snoozeUntil = new Date(T0.getTime() + 3 * HOUR);
    const result = await executeToolCall(
      {
        id: "call-1",
        name: "snooze_item",
        arguments: { item_id: itemId, snooze_until: snoozeUntil.toISOString() },
      },
      userId
    );
    expect(JSON.parse(result)).toMatchObject({ ok: true });

    await runSchedulerAt(new Date(T0.getTime() + 2 * HOUR));
    expect(await remindersQueued(itemId)).toBe(1);

    await runSchedulerAt(new Date(snoozeUntil.getTime() + 60_000));
    expect(await remindersQueued(itemId)).toBe(2);
  });
});

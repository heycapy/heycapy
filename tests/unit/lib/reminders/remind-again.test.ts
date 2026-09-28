import { describe, expect, it } from "vitest";
import { pendingRemindAgainAt } from "@/lib/reminders/remind-again";

const NOW = new Date("2026-03-10T12:00:00Z");
const at = (mins: number) => new Date(NOW.getTime() + mins * 60_000);
const item = (overrides: Partial<Parameters<typeof pendingRemindAgainAt>[0]>) => ({
  status: "active",
  remindNotBefore: at(15),
  nextReminderAt: null,
  nextOverdueAt: null,
  ...overrides,
});

describe("pendingRemindAgainAt", () => {
  it("is the reminder it re-armed", () => {
    expect(pendingRemindAgainAt(item({ nextReminderAt: at(15) }), NOW)).toEqual(at(15));
  });

  it("is the overdue alert when that's what it re-armed", () => {
    expect(pendingRemindAgainAt(item({ nextOverdueAt: at(20) }), NOW)).toEqual(at(20));
  });

  it("is nothing once it has passed, or when the item is closed", () => {
    expect(pendingRemindAgainAt(item({ remindNotBefore: at(-1) }), NOW)).toBeNull();
    expect(pendingRemindAgainAt(item({ status: "completed" }), NOW)).toBeNull();
    expect(pendingRemindAgainAt(item({ remindNotBefore: null }), NOW)).toBeNull();
  });
});

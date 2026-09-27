import { describe, it, expect } from "vitest";
import { reminderResetForDeadline } from "@/lib/items/reminders";

const now = new Date("2026-03-10T12:00:00Z");
const notifiedAt = new Date("2026-03-10T09:00:00Z");
const item = { deadline: new Date("2026-03-10T09:00:00Z"), notifiedAt };

describe("reminderResetForDeadline", () => {
  it("changes nothing when the deadline is the same", () => {
    expect(reminderResetForDeadline(item, new Date(item.deadline), now)).toEqual({});
  });

  it("re-arms both reminders when moved to the future", () => {
    expect(reminderResetForDeadline(item, new Date("2026-03-11T09:00:00Z"), now)).toEqual({
      notifiedAt: null,
      overdueNotifiedAt: null,
    });
  });

  it("keeps the sent reminder when moved to a time that already passed", () => {
    expect(reminderResetForDeadline(item, new Date("2026-03-10T10:00:00Z"), now)).toEqual({
      notifiedAt,
      overdueNotifiedAt: null,
    });
  });

  it("clears reminder state when the deadline is removed", () => {
    expect(reminderResetForDeadline(item, null, now)).toEqual({
      notifiedAt: null,
      overdueNotifiedAt: null,
    });
  });

  it("arms a reminder for an item that never had a deadline", () => {
    const undated = { deadline: null, notifiedAt: null };
    expect(reminderResetForDeadline(undated, new Date("2026-03-11T09:00:00Z"), now)).toEqual({
      notifiedAt: null,
      overdueNotifiedAt: null,
    });
  });
});

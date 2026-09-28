import { describe, it, expect } from "vitest";
import { initialReminderState, reminderResetForDeadline } from "@/lib/items/reminders";

const now = new Date("2026-03-10T12:00:00Z");
const ctx = (defaultOffsetMins = 0) => ({ defaultOffsetMins, notifyAt: "", timezone: "UTC" });
const notifiedAt = new Date("2026-03-10T09:00:00Z");
const item = {
  deadline: new Date("2026-03-10T09:00:00Z"),
  notifiedAt,
  notificationOffsetMins: null,
};

describe("reminderResetForDeadline", () => {
  it("changes nothing when the deadline is the same", () => {
    expect(reminderResetForDeadline(item, new Date(item.deadline), ctx(0), now)).toEqual({});
  });

  it("re-arms both reminders when moved to the future", () => {
    expect(reminderResetForDeadline(item, new Date("2026-03-11T09:00:00Z"), ctx(0), now)).toEqual({
      notifiedAt: null,
      overdueNotifiedAt: null,
      remindNotBefore: null,
    });
  });

  it("keeps the sent reminder when moved to a time that already passed", () => {
    expect(reminderResetForDeadline(item, new Date("2026-03-10T10:00:00Z"), ctx(0), now)).toEqual({
      notifiedAt,
      overdueNotifiedAt: null,
      remindNotBefore: null,
    });
  });

  it("marks the reminder done when a never-reminded item is moved into the past", () => {
    const fresh = {
      deadline: new Date("2026-03-11T09:00:00Z"),
      notifiedAt: null,
      notificationOffsetMins: null,
    };
    expect(reminderResetForDeadline(fresh, new Date("2026-03-10T10:00:00Z"), ctx(0), now)).toEqual({
      notifiedAt: now,
      overdueNotifiedAt: null,
      remindNotBefore: null,
    });
  });

  it("clears reminder state when the deadline is removed", () => {
    expect(reminderResetForDeadline(item, null, ctx(0), now)).toEqual({
      notifiedAt: null,
      overdueNotifiedAt: null,
      remindNotBefore: null,
    });
  });

  it("arms a reminder for an item that never had a deadline", () => {
    const undated = { deadline: null, notifiedAt: null, notificationOffsetMins: null };
    expect(
      reminderResetForDeadline(undated, new Date("2026-03-11T09:00:00Z"), ctx(0), now)
    ).toEqual({
      notifiedAt: null,
      overdueNotifiedAt: null,
      remindNotBefore: null,
    });
  });
});

describe("reminderResetForDeadline with an early reminder", () => {
  const tomorrow = new Date("2026-03-11T09:00:00Z");

  it("holds an already-sent reminder until the new deadline when its early time passed", () => {
    // Remind 1 day before: moving to tomorrow puts that time in the past
    expect(reminderResetForDeadline(item, tomorrow, ctx(24 * 60), now)).toMatchObject({
      notifiedAt: null,
      remindNotBefore: tomorrow,
    });
  });

  it("still sends the early reminder now for an item that was never reminded", () => {
    const fresh = { ...item, notifiedAt: null };
    expect(reminderResetForDeadline(fresh, tomorrow, ctx(24 * 60), now)).toMatchObject({
      remindNotBefore: null,
    });
  });

  it("keeps the early reminder when its time is still ahead", () => {
    expect(reminderResetForDeadline(item, tomorrow, ctx(60), now)).toMatchObject({
      notifiedAt: null,
      remindNotBefore: null,
    });
  });

  it("uses the item's own offset over the bucket default", () => {
    const itemOffset = { ...item, notificationOffsetMins: 24 * 60 };
    expect(reminderResetForDeadline(itemOffset, tomorrow, ctx(0), now)).toMatchObject({
      remindNotBefore: tomorrow,
    });
  });
});

describe("initialReminderState", () => {
  it("marks the reminder done for a new item whose date is already past", () => {
    expect(initialReminderState(new Date("2026-03-10T10:00:00Z"), "UTC", now)).toEqual({
      notifiedAt: now,
    });
  });

  it("leaves future and missing dates alone", () => {
    expect(initialReminderState(new Date("2026-03-11T10:00:00Z"), "UTC", now)).toEqual({});
    expect(initialReminderState(null, "UTC", now)).toEqual({});
  });
});

describe("all-day items", () => {
  const todayAllDay = new Date("2026-03-10T00:00:00Z");

  it("an all-day item for today isn't in the past yet", () => {
    expect(initialReminderState(todayAllDay, "UTC", now)).toEqual({});
  });

  it("holds a moved all-day item's reminder until its reminder time, not midnight", () => {
    const tomorrowAllDay = new Date("2026-03-11T00:00:00Z");
    expect(reminderResetForDeadline(item, tomorrowAllDay, ctx(24 * 60), now)).toMatchObject({
      remindNotBefore: new Date("2026-03-11T09:00:00Z"),
    });
  });
});

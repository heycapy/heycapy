import { describe, it, expect } from "vitest";
import { NotificationRules, ReminderOffsets } from "@/types/rules";
import {
  nextDeadlineReminder,
  nextOverdueAlert,
  type ReminderInputs,
} from "@/lib/reminders/schedule";

const deadline = new Date("2026-06-10T13:00:00Z"); // 09:00 in New York

function inputs(
  overrides: Partial<Omit<ReminderInputs, "rules">> & { rules?: Record<string, unknown> } = {}
): ReminderInputs {
  const { rules, ...rest } = overrides;
  return {
    deadline,
    status: "active",
    deletedAt: null,
    bucketLive: true,
    remindNotBefore: null,
    notifiedAt: null,
    overdueNotifiedAt: null,
    reminderOffsets: null,
    notifyWhenOverdue: false,
    overdueRepeatHours: undefined,
    timezone: "America/New_York",
    ...rest,
    rules: NotificationRules.parse({ medium: ["telegram"], ...rules }),
  };
}

const iso = (d: Date | null) => d?.toISOString() ?? null;

describe("nextDeadlineReminder", () => {
  it("is due at the deadline by default", () => {
    expect(iso(nextDeadlineReminder(inputs()))).toBe("2026-06-10T13:00:00.000Z");
  });

  it("applies the bucket offset, with the item offset taking precedence", () => {
    expect(iso(nextDeadlineReminder(inputs({ rules: { defaultReminders: [60] } })))).toBe(
      "2026-06-10T12:00:00.000Z"
    );
    expect(
      iso(
        nextDeadlineReminder(inputs({ rules: { defaultReminders: [60] }, reminderOffsets: [1440] }))
      )
    ).toBe("2026-06-09T13:00:00.000Z");
  });

  it("sends nothing for completed, on-hold, deleted or undated items", () => {
    expect(nextDeadlineReminder(inputs({ status: "completed" }))).toBeNull();
    expect(nextDeadlineReminder(inputs({ status: "on hold" }))).toBeNull();
    expect(nextDeadlineReminder(inputs({ deletedAt: new Date() }))).toBeNull();
    expect(nextDeadlineReminder(inputs({ deadline: null }))).toBeNull();
  });

  it("sends nothing while the bucket is deleted or archived", () => {
    expect(nextDeadlineReminder(inputs({ bucketLive: false }))).toBeNull();
    expect(nextOverdueAlert(inputs({ bucketLive: false, notifyWhenOverdue: true }))).toBeNull();
  });

  it("sends nothing when the bucket has no channels", () => {
    expect(nextDeadlineReminder(inputs({ rules: { medium: [] } }))).toBeNull();
  });

  it("'once' stops after the first reminder", () => {
    expect(nextDeadlineReminder(inputs({ notifiedAt: deadline }))).toBeNull();
  });

  it("'daily' repeats at the same local time the next day", () => {
    const next = nextDeadlineReminder(inputs({ rules: { repeat: "daily" }, notifiedAt: deadline }));
    expect(iso(next)).toBe("2026-06-11T13:00:00.000Z");
  });

  it("waits until the not-before time", () => {
    const remindNotBefore = new Date("2026-06-10T18:00:00Z");
    expect(iso(nextDeadlineReminder(inputs({ remindNotBefore })))).toBe(
      remindNotBefore.toISOString()
    );
  });

  it("holds reminders until the 'remind at' time of that day", () => {
    const early = inputs({
      deadline: new Date("2026-06-10T10:00:00Z"),
      rules: { notifyAt: "09:00" },
    });
    expect(iso(nextDeadlineReminder(early))).toBe("2026-06-10T13:00:00.000Z");

    const late = inputs({
      deadline: new Date("2026-06-10T22:00:00Z"),
      rules: { notifyAt: "09:00" },
    });
    expect(iso(nextDeadlineReminder(late))).toBe("2026-06-10T22:00:00.000Z");
  });

  it("moves reminders out of overnight quiet hours", () => {
    const quietHours = { from: "18:00", to: "09:00" };
    // 20:00 local → 09:00 next day
    const evening = inputs({ deadline: new Date("2026-06-11T00:00:00Z"), rules: { quietHours } });
    expect(iso(nextDeadlineReminder(evening))).toBe("2026-06-11T13:00:00.000Z");
    // 06:00 local → 09:00 same day
    const morning = inputs({ deadline: new Date("2026-06-10T10:00:00Z"), rules: { quietHours } });
    expect(iso(nextDeadlineReminder(morning))).toBe("2026-06-10T13:00:00.000Z");
  });

  it("moves reminders out of same-day quiet hours", () => {
    const lunch = inputs({
      deadline: new Date("2026-06-10T16:30:00Z"), // 12:30 local
      rules: { quietHours: { from: "12:00", to: "13:00" } },
    });
    expect(iso(nextDeadlineReminder(lunch))).toBe("2026-06-10T17:00:00.000Z");
  });

  it("satisfies 'remind at' and quiet hours together", () => {
    const both = inputs({
      deadline: new Date("2026-06-10T10:00:00Z"), // 06:00 local
      rules: { notifyAt: "08:00", quietHours: { from: "22:00", to: "09:30" } },
    });
    expect(iso(nextDeadlineReminder(both))).toBe("2026-06-10T13:30:00.000Z");
  });
});

describe("nextDeadlineReminder with several reminders", () => {
  const offsets = [1440, 60, 0];
  const dayBefore = "2026-06-09T13:00:00.000Z";
  const hourBefore = "2026-06-10T12:00:00.000Z";

  it("starts with the earliest", () => {
    expect(iso(nextDeadlineReminder(inputs({ reminderOffsets: offsets })))).toBe(dayBefore);
  });

  it("moves on to the next one after each goes out", () => {
    const sent = (at: string) => inputs({ reminderOffsets: offsets, notifiedAt: new Date(at) });
    expect(iso(nextDeadlineReminder(sent(dayBefore)))).toBe(hourBefore);
    expect(iso(nextDeadlineReminder(sent(hourBefore)))).toBe(deadline.toISOString());
    expect(nextDeadlineReminder(sent(deadline.toISOString()))).toBeNull();
  });

  it("drops the ones that fell due before the last one went out", () => {
    // Sent late (quiet hours, downtime): the 1-hour one passed meanwhile
    const late = inputs({ reminderOffsets: offsets, notifiedAt: new Date("2026-06-10T12:30:00Z") });
    expect(iso(nextDeadlineReminder(late))).toBe(deadline.toISOString());
  });

  it("repeats daily only after the last one", () => {
    const rules = { repeat: "daily" };
    const afterFirst = inputs({ rules, reminderOffsets: offsets, notifiedAt: new Date(dayBefore) });
    expect(iso(nextDeadlineReminder(afterFirst))).toBe(hourBefore);
    const afterLast = inputs({ rules, reminderOffsets: offsets, notifiedAt: deadline });
    expect(iso(nextDeadlineReminder(afterLast))).toBe("2026-06-11T13:00:00.000Z");
  });

  it("sends nothing for an empty list, whatever the bucket default", () => {
    expect(
      nextDeadlineReminder(inputs({ rules: { defaultReminders: [60] }, reminderOffsets: [] }))
    ).toBeNull();
  });

  it("holds each one to the 'remind at' time and quiet hours", () => {
    const quiet = inputs({
      reminderOffsets: [600, 0], // 23:00 the night before, then 09:00
      rules: { quietHours: { from: "22:00", to: "08:00" } },
    });
    expect(iso(nextDeadlineReminder(quiet))).toBe("2026-06-10T12:00:00.000Z");
  });
});

describe("NotificationRules defaultReminders", () => {
  it("is 'at time' when a bucket has none saved", () => {
    expect(NotificationRules.parse({}).defaultReminders).toEqual([0]);
  });

  it("keeps each once, largest first", () => {
    expect(NotificationRules.parse({ defaultReminders: [0, 60, 60] }).defaultReminders).toEqual([
      60, 0,
    ]);
  });
});

describe("ReminderOffsets", () => {
  it("keeps each offset once, largest first", () => {
    expect(ReminderOffsets.parse([0, 60, 1440, 60])).toEqual([1440, 60, 0]);
  });

  it("allows none", () => {
    expect(ReminderOffsets.parse([])).toEqual([]);
  });

  it("rejects negative, fractional, too distant or too many offsets", () => {
    expect(ReminderOffsets.safeParse([-5]).success).toBe(false);
    expect(ReminderOffsets.safeParse([1.5]).success).toBe(false);
    expect(ReminderOffsets.safeParse([91 * 24 * 60]).success).toBe(false);
    expect(ReminderOffsets.safeParse([0, 5, 10, 15]).success).toBe(true);
    expect(ReminderOffsets.safeParse([0, 5, 10, 15, 30]).success).toBe(false);
  });
});

describe("nextOverdueAlert", () => {
  it("is off unless the bucket enables it", () => {
    expect(nextOverdueAlert(inputs())).toBeNull();
  });

  it("is off when the bucket has no channels", () => {
    expect(nextOverdueAlert(inputs({ notifyWhenOverdue: true, rules: { medium: [] } }))).toBeNull();
  });

  it("first fires an hour after the deadline", () => {
    expect(iso(nextOverdueAlert(inputs({ notifyWhenOverdue: true })))).toBe(
      "2026-06-10T14:00:00.000Z"
    );
  });

  it("first fires after the bucket's chosen delay", () => {
    expect(
      iso(nextOverdueAlert(inputs({ notifyWhenOverdue: true, overdueFirstAlertMins: 30 })))
    ).toBe("2026-06-10T13:30:00.000Z");
  });

  it("repeats on the configured interval, or stops without one", () => {
    const last = new Date("2026-06-10T14:00:00Z");
    expect(
      iso(
        nextOverdueAlert(
          inputs({ notifyWhenOverdue: true, overdueNotifiedAt: last, overdueRepeatHours: 4 })
        )
      )
    ).toBe("2026-06-10T18:00:00.000Z");
    expect(
      nextOverdueAlert(inputs({ notifyWhenOverdue: true, overdueNotifiedAt: last }))
    ).toBeNull();
  });

  it("waits until the not-before time and skips completed items", () => {
    const remindNotBefore = new Date("2026-06-11T00:00:00Z");
    expect(iso(nextOverdueAlert(inputs({ notifyWhenOverdue: true, remindNotBefore })))).toBe(
      remindNotBefore.toISOString()
    );
    expect(nextOverdueAlert(inputs({ notifyWhenOverdue: true, status: "completed" }))).toBeNull();
  });
});

describe("your own quiet hours", () => {
  const night = { from: "22:00", to: "07:00" };

  it("hold every bucket's reminders until they end", () => {
    // 23:30 local
    const late = inputs({ deadline: new Date("2026-06-11T03:30:00Z"), userQuietHours: night });
    expect(iso(nextDeadlineReminder(late))).toBe("2026-06-11T11:00:00.000Z");
  });

  it("stack with a bucket's own quiet hours", () => {
    // 06:30 local: held to 07:00 by yours, then to 08:00 by the bucket's
    const early = inputs({
      deadline: new Date("2026-06-10T10:30:00Z"),
      userQuietHours: night,
      rules: { quietHours: { from: "07:00", to: "08:00" } },
    });
    expect(iso(nextDeadlineReminder(early))).toBe("2026-06-10T12:00:00.000Z");
  });

  it("hold overdue alerts too, but 'remind at' stays a reminder-only rule", () => {
    // due 22:00 local, overdue alert straight away → held to 07:00, not to "remind at" 09:00
    const overdue = inputs({
      deadline: new Date("2026-06-11T02:00:00Z"),
      notifyWhenOverdue: true,
      overdueFirstAlertMins: 0,
      userQuietHours: night,
      rules: { notifyAt: "09:00" },
    });
    expect(iso(nextOverdueAlert(overdue))).toBe("2026-06-11T11:00:00.000Z");
  });

  it("change nothing when they're off", () => {
    expect(iso(nextDeadlineReminder(inputs({ userQuietHours: null })))).toBe(
      "2026-06-10T13:00:00.000Z"
    );
  });
});

describe("an all-day item set in India", () => {
  const oct26India = new Date("2026-10-25T18:30:00Z");
  const allDay = (timezone: string) =>
    inputs({
      deadline: oct26India,
      deadlineTimezone: "Asia/Kolkata",
      timezone,
      rules: { notifyAt: "09:00" },
    });

  it("reminds each recipient at 09:00 on that date on their own clock, after the UK clock change", () => {
    expect(iso(nextDeadlineReminder(allDay("Asia/Kolkata")))).toBe("2026-10-26T03:30:00.000Z");
    expect(iso(nextDeadlineReminder(allDay("Europe/London")))).toBe("2026-10-26T09:00:00.000Z");
  });

  it("stays all day for someone who moved to another timezone after setting it", () => {
    expect(iso(nextDeadlineReminder(allDay("America/New_York")))).toBe("2026-10-26T13:00:00.000Z");
  });
});

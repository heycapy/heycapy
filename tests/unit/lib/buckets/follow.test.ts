import { describe, expect, it } from "vitest";
import { followedRules, keepFollowing, type FollowableValues } from "@/lib/buckets/follow";
import { OVERDUE_FIRST_ALERT_DEFAULT_MINS } from "@/lib/reminders/constants";

const values: FollowableValues = {
  defaultReminders: [1440, 0],
  notifyAt: "09:00",
  repeat: "once",
  overdue: { notifyWhenOverdue: true, overdueRepeatHours: 2 },
};

describe("keepFollowing", () => {
  it("drops only the settings whose value changed", () => {
    expect(
      keepFollowing(["defaultReminders", "repeat"], values, { ...values, repeat: "daily" })
    ).toEqual(["defaultReminders"]);
  });

  it("counts an unset first overdue alert as the default one", () => {
    const explicit: FollowableValues = {
      ...values,
      overdue: { ...values.overdue, overdueFirstAlertMins: OVERDUE_FIRST_ALERT_DEFAULT_MINS },
    };
    expect(keepFollowing(["overdue"], values, explicit)).toEqual(["overdue"]);
  });
});

describe("followedRules", () => {
  it("clears the overdue times when overdue alerts are off", () => {
    const off = { ...values, overdue: { notifyWhenOverdue: false } };
    expect(followedRules(["overdue"], off).overdue).toEqual({
      notifyWhenOverdue: false,
      overdueFirstAlertMins: undefined,
      overdueRepeatHours: undefined,
    });
  });

  it("leaves out the settings that don't follow", () => {
    expect(followedRules(["notifyAt"], values)).toEqual({
      notifications: { notifyAt: "09:00" },
      overdue: {},
    });
  });
});

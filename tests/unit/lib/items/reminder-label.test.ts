import { describe, it, expect } from "vitest";
import { describeReminder } from "@/lib/items/reminder-label";

describe("describeReminder", () => {
  it("names the deadline itself by the kind of date", () => {
    expect(describeReminder(0, false)).toBe("at time");
    expect(describeReminder(0, true)).toBe("on the day");
  });

  it("uses the largest unit that fits exactly", () => {
    expect(describeReminder(15, false)).toBe("15 min before");
    expect(describeReminder(60, false)).toBe("1 hour before");
    expect(describeReminder(90, false)).toBe("90 min before");
    expect(describeReminder(120, false)).toBe("2 hours before");
    expect(describeReminder(1440, true)).toBe("1 day before");
    expect(describeReminder(2880, false)).toBe("2 days before");
    expect(describeReminder(10080, false)).toBe("1 week before");
    expect(describeReminder(14 * 1440, false)).toBe("2 weeks before");
  });
});

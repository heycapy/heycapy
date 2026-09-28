import { describe, expect, it } from "vitest";
import { describeRepeat, repeatLabel } from "@/lib/items/repeat-label";
import type { RecurringConfig } from "@/types/rules";

const weekly: RecurringConfig = { enabled: true, frequency: "weekly", interval: 1, endDate: null };

describe("repeat wording", () => {
  it("names the picked days, Monday first", () => {
    const days = { ...weekly, weekdays: [5, 1, 3] };
    expect(describeRepeat(days)).toBe("every week on mon, wed, fri");
    expect(repeatLabel(days)).toBe("mon, wed, fri");
  });

  it("calls Monday to Friday weekdays", () => {
    const weekdays = { ...weekly, weekdays: [1, 2, 3, 4, 5] };
    expect(describeRepeat(weekdays)).toBe("every weekday");
    expect(repeatLabel(weekdays)).toBe("weekdays");
  });

  it("mentions the interval when it isn't every week", () => {
    const biweekly = { ...weekly, interval: 2, weekdays: [1, 5] };
    expect(describeRepeat(biweekly)).toBe("every 2 weeks on mon, fri");
    expect(repeatLabel(biweekly)).toBe("mon, fri · every 2 weeks");
  });

  it("says last day for monthly on day 31, and stays plain otherwise", () => {
    const lastDay: RecurringConfig = { ...weekly, frequency: "monthly", anchorDay: 31 };
    expect(describeRepeat(lastDay)).toBe("every month on the last day");
    expect(repeatLabel(lastDay)).toBe("monthly · last day");
    expect(describeRepeat({ ...weekly, frequency: "daily", interval: 3 })).toBe("every 3 days");
    expect(repeatLabel(weekly)).toBe("weekly");
  });
});

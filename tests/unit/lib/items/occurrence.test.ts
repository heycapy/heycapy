import { describe, it, expect } from "vitest";
import { nextOccurrenceDate, parseRecurring } from "@/lib/items/occurrence";
import type { RecurringConfig } from "@/types/rules";

const now = new Date("2026-03-10T12:00:00Z");
const monthly: RecurringConfig = {
  enabled: true,
  frequency: "monthly",
  interval: 1,
  endDate: null,
};

describe("nextOccurrenceDate", () => {
  it("returns the next date on the schedule", () => {
    const next = nextOccurrenceDate(new Date("2026-03-13T12:00:00Z"), monthly, now);
    expect(next?.toISOString()).toBe("2026-04-13T12:00:00.000Z");
  });

  it("respects the interval", () => {
    const everyTwoWeeks: RecurringConfig = { ...monthly, frequency: "weekly", interval: 2 };
    const next = nextOccurrenceDate(new Date("2026-03-13T12:00:00Z"), everyTwoWeeks, now);
    expect(next?.toISOString()).toBe("2026-03-27T12:00:00.000Z");
  });

  it("skips occurrences that are already in the past", () => {
    const next = nextOccurrenceDate(new Date("2026-01-01T12:00:00Z"), monthly, now);
    expect(next?.toISOString()).toBe("2026-04-01T12:00:00.000Z");
  });

  it("returns null once the end date is passed", () => {
    const ending: RecurringConfig = { ...monthly, endDate: "2026-04-01" };
    expect(nextOccurrenceDate(new Date("2026-03-13T12:00:00Z"), ending, now)).toBeNull();
  });

  it("returns null when repeating is turned off", () => {
    const off: RecurringConfig = { ...monthly, enabled: false };
    expect(nextOccurrenceDate(new Date("2026-03-13T12:00:00Z"), off, now)).toBeNull();
  });
});

describe("parseRecurring", () => {
  it("parses a stored rule, including one that is turned off", () => {
    expect(parseRecurring(JSON.stringify(monthly))).toEqual(monthly);
    expect(parseRecurring(JSON.stringify({ ...monthly, enabled: false }))?.enabled).toBe(false);
  });

  it("returns null for missing or corrupt rules", () => {
    expect(parseRecurring(null)).toBeNull();
    expect(parseRecurring("{nope")).toBeNull();
    expect(parseRecurring(JSON.stringify({ frequency: "hourly" }))).toBeNull();
  });
});

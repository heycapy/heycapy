import { describe, it, expect } from "vitest";
import {
  followingOccurrence,
  nextAfterCompletion,
  nextOccurrenceDate,
  parseRecurring,
  withAnchor,
} from "@/lib/items/occurrence";
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
    const next = nextOccurrenceDate(new Date("2026-03-13T12:00:00Z"), monthly, "UTC", now);
    expect(next?.toISOString()).toBe("2026-04-13T12:00:00.000Z");
  });

  it("respects the interval", () => {
    const everyTwoWeeks: RecurringConfig = { ...monthly, frequency: "weekly", interval: 2 };
    const next = nextOccurrenceDate(new Date("2026-03-13T12:00:00Z"), everyTwoWeeks, "UTC", now);
    expect(next?.toISOString()).toBe("2026-03-27T12:00:00.000Z");
  });

  it("skips occurrences that are already in the past", () => {
    const next = nextOccurrenceDate(new Date("2026-01-01T12:00:00Z"), monthly, "UTC", now);
    expect(next?.toISOString()).toBe("2026-04-01T12:00:00.000Z");
  });

  it("returns null once the end date is passed", () => {
    const ending: RecurringConfig = { ...monthly, endDate: "2026-04-01" };
    expect(nextOccurrenceDate(new Date("2026-03-13T12:00:00Z"), ending, "UTC", now)).toBeNull();
  });

  it("returns null when repeating is turned off", () => {
    const off: RecurringConfig = { ...monthly, enabled: false };
    expect(nextOccurrenceDate(new Date("2026-03-13T12:00:00Z"), off, "UTC", now)).toBeNull();
  });
});

describe("nextOccurrenceDate at the edges", () => {
  const yearly: RecurringConfig = { ...monthly, frequency: "yearly" };
  const daily: RecurringConfig = { ...monthly, frequency: "daily" };
  const iso = (d: Date | null) => d?.toISOString();

  it("moves a month-end date to the last day of shorter months, then back", () => {
    const jan31 = new Date("2027-01-31T09:00:00Z");
    const early = new Date("2027-01-31T10:00:00Z");
    const feb = nextOccurrenceDate(jan31, monthly, "UTC", early);
    expect(iso(feb)).toBe("2027-02-28T09:00:00.000Z");
    const anchored = withAnchor(monthly, jan31, "UTC");
    expect(iso(nextOccurrenceDate(feb ?? jan31, anchored, "UTC", early))).toBe(
      "2027-03-31T09:00:00.000Z"
    );
  });

  it("keeps a Feb 29 birthday on Feb 29 in leap years", () => {
    const leap = new Date("2028-02-29T09:00:00Z");
    const anchored = withAnchor(yearly, leap, "UTC");
    const next = nextOccurrenceDate(leap, anchored, "UTC", new Date("2028-03-01T00:00:00Z"));
    expect(iso(next)).toBe("2029-02-28T09:00:00.000Z");
    const later = nextOccurrenceDate(
      new Date("2031-02-28T09:00:00Z"),
      anchored,
      "UTC",
      new Date("2031-03-01T00:00:00Z")
    );
    expect(iso(later)).toBe("2032-02-29T09:00:00.000Z");
  });

  it("keeps the local clock time across a daylight-saving change", () => {
    // 9:00 EST on Mar 7; clocks spring forward on Mar 8, so 9:00 EDT is 13:00 UTC
    const next = nextOccurrenceDate(
      new Date("2026-03-07T14:00:00Z"),
      daily,
      "America/New_York",
      new Date("2026-03-07T15:00:00Z")
    );
    expect(iso(next)).toBe("2026-03-08T13:00:00.000Z");
  });

  it("counts the whole end date in the user's timezone", () => {
    const endsOnThe13th: RecurringConfig = { ...daily, endDate: "2026-03-13" };
    // 23:00 on Mar 13 in Kolkata is still inside the end date
    const next = nextOccurrenceDate(
      new Date("2026-03-12T17:30:00Z"),
      endsOnThe13th,
      "Asia/Kolkata",
      new Date("2026-03-12T18:00:00Z")
    );
    expect(iso(next)).toBe("2026-03-13T17:30:00.000Z");
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

describe("followingOccurrence and nextAfterCompletion", () => {
  const every3Days: RecurringConfig = { ...monthly, frequency: "daily", interval: 3 };

  it("followingOccurrence gives the very next date even when it's already past", () => {
    const next = followingOccurrence(new Date("2026-01-01T09:00:00Z"), monthly, "UTC");
    expect(next?.toISOString()).toBe("2026-02-01T09:00:00.000Z");
  });

  it("nextAfterCompletion counts from the completion day and keeps the item's time", () => {
    const next = nextAfterCompletion(
      new Date("2026-03-10T09:00:00Z"),
      every3Days,
      "UTC",
      new Date("2026-03-12T18:00:00Z")
    );
    expect(next?.toISOString()).toBe("2026-03-15T09:00:00.000Z");
  });

  it("nextAfterCompletion uses the user's local day", () => {
    // Completed at 00:30 on Mar 13 in Kolkata (still Mar 12 in UTC)
    const next = nextAfterCompletion(
      new Date("2026-03-10T03:30:00Z"),
      every3Days,
      "Asia/Kolkata",
      new Date("2026-03-12T19:00:00Z")
    );
    expect(next?.toISOString()).toBe("2026-03-16T03:30:00.000Z");
  });
});

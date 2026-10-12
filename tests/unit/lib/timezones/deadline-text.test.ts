import { describe, expect, it } from "vitest";
import { localDateToDate } from "@/lib/reminders/zoned";
import { deadlineOnBothClocks } from "@/lib/timezones/deadline-text";

const INDIA = "Asia/Kolkata";
const LONDON = "Europe/London";
const NOW = new Date("2026-10-26T06:00:00Z");

describe("deadlineOnBothClocks", () => {
  it("names both places when the time was set on another clock", () => {
    const deadline = new Date("2026-10-26T09:30:00Z");
    expect(deadlineOnBothClocks(deadline, INDIA, NOW, LONDON)).toBe(
      "today, 9:30 AM UK (3:00 PM India)"
    );
  });

  it("follows the UK clock change on 25 Oct 2026", () => {
    const before = new Date("2026-10-24T09:30:00Z");
    expect(deadlineOnBothClocks(before, INDIA, new Date("2026-10-24T06:00:00Z"), LONDON)).toBe(
      "today, 10:30 AM UK (3:00 PM India)"
    );
  });

  it("gives the other clock's day when it isn't the same date there", () => {
    const deadline = new Date("2026-10-26T22:00:00Z");
    expect(deadlineOnBothClocks(deadline, LONDON, NOW, INDIA)).toBe(
      "tomorrow, 3:30 AM India (today, 10:00 PM UK)"
    );
  });

  it("says UTC for a clock that was never set", () => {
    const deadline = new Date("2026-10-26T09:30:00Z");
    expect(deadlineOnBothClocks(deadline, INDIA, NOW, "UTC")).toBe(
      "today, 9:30 AM UTC (3:00 PM India)"
    );
  });

  it("leaves the time alone on the clock it was set on", () => {
    const deadline = new Date("2026-10-26T09:30:00Z");
    expect(deadlineOnBothClocks(deadline, INDIA, NOW, INDIA)).toBe("today, 3:00 PM");
    expect(deadlineOnBothClocks(deadline, "Asia/Calcutta", NOW, INDIA)).toBe("today, 3:00 PM");
  });

  it("leaves an all-day date alone, it's the same date for everyone", () => {
    const deadline = localDateToDate("2026-10-27", INDIA);
    expect(deadlineOnBothClocks(deadline, INDIA, NOW, LONDON)).toBe("tomorrow");
  });
});

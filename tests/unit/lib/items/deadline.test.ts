import { describe, it, expect } from "vitest";
import { onClock, resolveDeadline } from "@/lib/items/deadline";

const INDIA = "Asia/Kolkata";
const LONDON = "Europe/London";
const OCT_12_INDIA = new Date("2026-10-11T18:30:00Z");
const OCT_13_LONDON = new Date("2026-10-12T23:00:00Z");
const NINE_AM_INDIA = new Date("2026-10-12T03:30:00Z");

describe("resolveDeadline", () => {
  it("reads a new date on the setter's clock", () => {
    expect(resolveDeadline("2026-10-13", LONDON)).toEqual({
      deadline: OCT_13_LONDON,
      deadlineTimezone: LONDON,
    });
  });

  it("keeps an all-day item that is saved again with its own date, from any clock", () => {
    const saved = { deadline: OCT_12_INDIA, deadlineTimezone: INDIA };
    expect(resolveDeadline("2026-10-12", LONDON, saved)).toBe(saved);
  });

  it("keeps a time saved again unchanged on the clock it was set on", () => {
    const saved = { deadline: NINE_AM_INDIA, deadlineTimezone: INDIA };
    expect(resolveDeadline(NINE_AM_INDIA.toISOString(), LONDON, saved)).toBe(saved);
  });

  it("treats a time that lands on another clock's midnight as a time, not that all-day date", () => {
    const saved = { deadline: OCT_12_INDIA, deadlineTimezone: INDIA };
    expect(resolveDeadline(OCT_12_INDIA.toISOString(), LONDON, saved)).toEqual({
      deadline: OCT_12_INDIA,
      deadlineTimezone: LONDON,
    });
  });

  it("clears the clock along with the date", () => {
    const saved = { deadline: OCT_12_INDIA, deadlineTimezone: INDIA };
    expect(resolveDeadline(null, LONDON, saved)).toEqual({
      deadline: null,
      deadlineTimezone: null,
    });
  });
});

describe("onClock", () => {
  it("keeps an all-day date as that date on the other clock", () => {
    expect(onClock({ deadline: OCT_13_LONDON, deadlineTimezone: LONDON }, INDIA)).toEqual({
      deadline: new Date("2026-10-12T18:30:00Z"),
      deadlineTimezone: INDIA,
    });
  });

  it("keeps a time as the same moment", () => {
    expect(onClock({ deadline: NINE_AM_INDIA, deadlineTimezone: LONDON }, INDIA)).toEqual({
      deadline: NINE_AM_INDIA,
      deadlineTimezone: INDIA,
    });
  });
});

import { describe, it, expect } from "vitest";
import {
  addLocalDays,
  atLocalClock,
  endOfMonthDateString,
  fromLocal,
  overdueFrom,
  parseClock,
  parseLocalDateTime,
  toLocal,
  utcOffset,
} from "@/lib/reminders/zoned";

const NY = "America/New_York";

describe("toLocal / fromLocal", () => {
  it("round-trips an ordinary time", () => {
    const local = { year: 2026, month: 6, day: 10, hour: 9, minute: 0 };
    const instant = fromLocal(local, NY);
    expect(instant.toISOString()).toBe("2026-06-10T13:00:00.000Z");
    expect(toLocal(instant, NY)).toEqual(local);
  });

  it("handles half-hour offsets", () => {
    const instant = fromLocal({ year: 2026, month: 1, day: 5, hour: 9, minute: 0 }, "Asia/Kolkata");
    expect(instant.toISOString()).toBe("2026-01-05T03:30:00.000Z");
  });

  it("resolves times right after spring-forward correctly", () => {
    // DST starts 2026-03-08 02:00 in New York; 04:00 EDT is 08:00 UTC
    const instant = fromLocal({ year: 2026, month: 3, day: 8, hour: 4, minute: 0 }, NY);
    expect(instant.toISOString()).toBe("2026-03-08T08:00:00.000Z");
  });

  it("moves a skipped wall time past the DST gap", () => {
    const instant = fromLocal({ year: 2026, month: 3, day: 8, hour: 2, minute: 30 }, NY);
    expect(toLocal(instant, NY).hour).toBe(3);
  });

  it("resolves times right after fall-back correctly", () => {
    // DST ends 2026-11-01 02:00 in New York; 03:00 EST is 08:00 UTC
    const instant = fromLocal({ year: 2026, month: 11, day: 1, hour: 3, minute: 0 }, NY);
    expect(instant.toISOString()).toBe("2026-11-01T08:00:00.000Z");
  });

  it("rolls over out-of-range days", () => {
    const instant = fromLocal({ year: 2026, month: 1, day: 32, hour: 9, minute: 0 }, "UTC");
    expect(instant.toISOString()).toBe("2026-02-01T09:00:00.000Z");
  });
});

describe("addLocalDays", () => {
  it("keeps the wall-clock time across a DST change", () => {
    const beforeDst = new Date("2026-03-07T14:00:00Z"); // 09:00 EST
    const next = addLocalDays(beforeDst, 1, NY);
    expect(toLocal(next, NY)).toMatchObject({ day: 8, hour: 9, minute: 0 });
    expect(next.toISOString()).toBe("2026-03-08T13:00:00.000Z");
  });
});

describe("atLocalClock", () => {
  it("returns the given clock time on the same local day", () => {
    const evening = new Date("2026-06-11T00:30:00Z"); // 20:30 on June 10 in New York
    expect(atLocalClock(evening, 9 * 60, NY).toISOString()).toBe("2026-06-10T13:00:00.000Z");
    expect(atLocalClock(evening, 9 * 60, NY, 1).toISOString()).toBe("2026-06-11T13:00:00.000Z");
  });
});

describe("parseClock", () => {
  it("parses valid times and rejects invalid ones", () => {
    expect(parseClock("08:15")).toBe(495);
    expect(parseClock("0:00")).toBe(0);
    expect(parseClock("24:00")).toBeNull();
    expect(parseClock("9am")).toBeNull();
    expect(parseClock("")).toBeNull();
  });
});

describe("shared date helpers", () => {
  it("utcOffset has the right sign east and west of UTC", () => {
    const at = new Date("2026-03-10T12:00:00Z");
    expect(utcOffset(at, "Asia/Kolkata")).toBe("+05:30");
    expect(utcOffset(at, NY)).toBe("-04:00");
    expect(utcOffset(new Date("2026-01-10T12:00:00Z"), NY)).toBe("-05:00");
    expect(utcOffset(at, "UTC")).toBe("+00:00");
  });

  it("parseLocalDateTime reads dates as all day, naive times as local, offsets as exact", () => {
    expect(parseLocalDateTime("2026-03-11", "Asia/Kolkata").toISOString()).toBe(
      "2026-03-10T18:30:00.000Z"
    );
    expect(parseLocalDateTime("2026-03-11T09:30:00", "Asia/Kolkata").toISOString()).toBe(
      "2026-03-11T04:00:00.000Z"
    );
    expect(parseLocalDateTime("2026-03-11T09:30:00+05:30", NY).toISOString()).toBe(
      "2026-03-11T04:00:00.000Z"
    );
    expect(parseLocalDateTime("2026-03-11T04:00:00Z", NY).toISOString()).toBe(
      "2026-03-11T04:00:00.000Z"
    );
  });

  it("endOfMonthDateString uses the user's calendar", () => {
    // Still Feb 28 in New York, already Mar 1 in UTC
    expect(endOfMonthDateString(new Date("2027-03-01T03:00:00Z"), NY)).toBe("2027-02-28");
    expect(endOfMonthDateString(new Date("2028-02-10T12:00:00Z"), "UTC")).toBe("2028-02-29");
  });
});

describe("an all-day item set on another clock", () => {
  const INDIA = "Asia/Kolkata";
  const LONDON = "Europe/London";

  it("is overdue when its date ends on each person's own clock", () => {
    const oct12 = new Date("2026-10-11T18:30:00Z");
    expect(overdueFrom(oct12, INDIA).toISOString()).toBe("2026-10-12T18:30:00.000Z");
    expect(overdueFrom(oct12, INDIA, LONDON).toISOString()).toBe("2026-10-12T23:00:00.000Z");
  });

  it("follows the UK clock change on 25 Oct 2026", () => {
    const oct25 = new Date("2026-10-24T18:30:00Z");
    const oct26 = new Date("2026-10-25T18:30:00Z");
    expect(overdueFrom(oct25, INDIA, LONDON).toISOString()).toBe("2026-10-26T00:00:00.000Z");
    expect(overdueFrom(oct26, INDIA, LONDON).toISOString()).toBe("2026-10-27T00:00:00.000Z");
  });

  it("is a time, not a date, when it only lands on midnight on the other clock", () => {
    const halfPastFourIndia = new Date("2026-10-12T23:00:00Z");
    expect(overdueFrom(halfPastFourIndia, INDIA, LONDON)).toEqual(halfPastFourIndia);
  });
});

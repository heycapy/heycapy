import { describe, it, expect } from "vitest";
import { addLocalDays, atLocalClock, fromLocal, parseClock, toLocal } from "@/lib/reminders/zoned";

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

import { describe, expect, it } from "vitest";
import { deadlineOn, quickDates } from "@/lib/items/quick-dates";

const at = (day: number, h: number, m = 0) => new Date(2026, 8, day, h, m);
const now = at(29, 15, 0);

function summary(current: Date | null, when = now) {
  return quickDates(current, when).map((o) => [o.label, o.at, o.allDay]);
}

describe("quickDates", () => {
  it("keeps the item's time when it's still ahead", () => {
    expect(summary(at(28, 21))).toEqual([
      ["due today", at(29, 21), false],
      ["due tomorrow", at(30, 21), false],
      ["due next week", new Date(2026, 9, 6, 21), false],
    ]);
  });

  it("today's option moves to the next half hour when the time has passed", () => {
    expect(summary(at(28, 9))[0]).toEqual(["due today", at(29, 15, 30), false]);
    expect(summary(at(28, 9))[1]).toEqual(["due tomorrow", at(30, 9), false]);
  });

  it("an all-day item stays all day", () => {
    expect(summary(at(28, 0))).toEqual([
      ["due today", at(29, 0), true],
      ["due tomorrow", at(30, 0), true],
      ["due next week", new Date(2026, 9, 6), true],
    ]);
  });

  it("an item without a date starts at 9am, or the next half hour today", () => {
    expect(summary(null)).toEqual([
      ["due today", at(29, 15, 30), false],
      ["due tomorrow", at(30, 9), false],
      ["due next week", new Date(2026, 9, 6, 9), false],
    ]);
    expect(summary(null, at(29, 8))[0]).toEqual(["due today", at(29, 9), false]);
  });

  it("late at night, today's option for an item without a date is all day", () => {
    expect(summary(null, at(29, 23, 45))[0]).toEqual(["due today", at(29, 0), true]);
  });

  it("leaves out the option the item is already on", () => {
    expect(summary(at(30, 18)).map(([label]) => label)).toEqual(["due today", "due next week"]);
  });

  it("crosses into the next month and year", () => {
    const newYearsEve = new Date(2026, 11, 31, 10);
    expect(quickDates(null, newYearsEve).map((o) => o.at)).toEqual([
      new Date(2026, 11, 31, 10, 30),
      new Date(2027, 0, 1, 9),
      new Date(2027, 0, 7, 9),
    ]);
  });
});

describe("deadlineOn", () => {
  it("a picked date keeps the time, even in the past", () => {
    expect(deadlineOn("2026-09-20", at(28, 21), now)).toBe(at(20, 21).toISOString());
  });

  it("a picked all-day date stays a date", () => {
    expect(deadlineOn("2026-10-02", at(28, 0), now)).toBe("2026-10-02");
  });
});

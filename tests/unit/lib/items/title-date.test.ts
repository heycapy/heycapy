import { describe, it, expect } from "vitest";
import { findTitleDate } from "@/lib/items/title-date";

// Wednesday Sep 30 2026, 10:00 in the machine's timezone, like the browser's
const now = new Date(2026, 8, 30, 10, 0);
const at = (month: number, day: number, hour: number, min = 0) =>
  new Date(2026, month - 1, day, hour, min).toISOString();

describe("findTitleDate", () => {
  it("reads a day and a time, and takes them out of the title", () => {
    expect(findTitleDate("pay rent friday 5pm", now)).toEqual({
      start: 9,
      end: 19,
      title: "pay rent",
      deadline: at(10, 2, 17),
    });
  });

  it("reads the common ways of writing a date", () => {
    const cases: [string, string, string][] = [
      ["dentist tomorrow at 3:30pm", "dentist", at(10, 1, 15, 30)],
      ["renew passport oct 12 at 9", "renew passport", at(10, 12, 9)],
      ["standup mon 9am", "standup", at(10, 5, 9)],
      ["tennis sat 9am", "tennis", at(10, 3, 9)],
      ["stretch in 30 min", "stretch", at(9, 30, 10, 30)],
      ["gym 6pm", "gym", at(9, 30, 18)],
    ];
    for (const [typed, title, deadline] of cases) {
      expect(findTitleDate(typed, now), typed).toMatchObject({ title, deadline });
    }
  });

  it("means the coming day, never one that has passed", () => {
    expect(findTitleDate("meeting next friday", now)?.deadline).toBe(at(10, 9, 9));
    expect(findTitleDate("birthday sept 3rd", now)?.deadline).toBe(
      new Date(2027, 8, 3, 9).toISOString()
    );
  });

  it("gives a date without a time the picker's time", () => {
    expect(findTitleDate("call mom tomorrow", now)?.deadline).toBe(at(10, 1, 9));
    expect(findTitleDate("pay rent friday", now)?.deadline).toBe(at(10, 2, 9));
    // 9am has passed today: the next half hour
    expect(findTitleDate("run today", now)?.deadline).toBe(at(9, 30, 10, 30));
    // Too late for any time today: all day
    expect(findTitleDate("run today", new Date(2026, 8, 30, 23, 45))?.deadline).toBe("2026-09-30");
  });

  it("keeps the time a time-of-day word gives", () => {
    expect(findTitleDate("call tonight", now)?.deadline).toBe(at(9, 30, 22));
    expect(findTitleDate("run tomorrow morning", now)?.deadline).toBe(at(10, 1, 9));
    expect(findTitleDate("run tomorrow at 7 in the morning", now)?.deadline).toBe(at(10, 1, 7));
    expect(findTitleDate("review friday afternoon", now)?.deadline).toBe(at(10, 2, 15));
  });

  it("takes a leading 'by', 'on' or 'due' out with the date", () => {
    expect(findTitleDate("pay rent by friday", now)).toMatchObject({
      start: 9,
      title: "pay rent",
    });
    expect(findTitleDate("rent due oct 12", now)?.title).toBe("rent");
  });

  it("leaves titles that only look like dates alone", () => {
    for (const typed of [
      "march on washington",
      "sat exam prep",
      "sun cream",
      "wed plans",
      "do it now",
      "buy 2 apples",
      "read chapter 5",
      "iphone 15",
      "fix bug #12",
      "book flight to paris",
    ]) {
      expect(findTitleDate(typed, now), typed).toBeNull();
    }
  });

  it("skips an everyday word and still finds the date after it", () => {
    expect(findTitleDate("sat exam friday", now)).toMatchObject({
      title: "sat exam",
      deadline: at(10, 2, 9),
    });
  });

  it("leaves a title that is only a date alone, so it isn't emptied", () => {
    expect(findTitleDate("tomorrow", now)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { dueLabel } from "@/lib/items/due-label";

const at = (day: number, h = 0, m = 0) => new Date(2026, 10, day, h, m);
const now = at(3, 15);
const timed = (d: Date) => ({ at: d, allDay: false });
const allDay = (d: Date) => ({ at: d, allDay: true });

describe("dueLabel", () => {
  it("counts the days an item is late, with its date", () => {
    expect(dueLabel(timed(at(1, 22, 39)), "active", now)).toEqual({
      tone: "late",
      state: "2d late",
      short: "01/11/26",
      full: "01/11/26 10:39 pm",
    });
  });

  it("an item due earlier today is late, a later one is today", () => {
    expect(dueLabel(timed(at(3, 9)), "active", now)).toMatchObject({
      tone: "late",
      state: "late",
      short: "9:00 am",
    });
    expect(dueLabel(timed(at(3, 17)), "active", now)).toMatchObject({
      tone: "today",
      state: "today",
      short: "5:00 pm",
    });
    expect(dueLabel(allDay(at(3)), "active", now)).toMatchObject({
      tone: "today",
      short: "all day",
    });
  });

  it("names the weekday this week and the date further out", () => {
    expect(dueLabel(timed(at(4, 9)), "active", now)).toEqual({
      tone: "near",
      state: "tomorrow",
      short: "Wed",
      full: "Wed 04/11/26 9:00 am",
    });
    expect(dueLabel(allDay(at(5)), "active", now)).toMatchObject({
      tone: "near",
      state: "in 2d",
      full: "Thu 05/11/26",
    });
    expect(dueLabel(timed(at(7, 10)), "active", now)).toMatchObject({
      tone: "later",
      state: "in 4d",
      short: "Sat",
    });
    expect(dueLabel(timed(at(23, 10)), "active", now)).toEqual({
      tone: "later",
      state: "in 20d",
      short: "23/11/26",
      full: "23/11/26 10:00 am",
    });
  });

  it("a done or missed item says so instead of how late it is", () => {
    expect(dueLabel(timed(at(1, 9)), "completed", now)).toMatchObject({
      tone: "closed",
      state: "done",
    });
    expect(dueLabel(timed(at(1, 9)), "missed", now)).toMatchObject({
      tone: "closed",
      state: "missed",
    });
  });
});

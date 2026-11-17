import { describe, it, expect } from "vitest";
import {
  dateShortcuts,
  firstMissingRequired,
  inlinePatch,
  pickDate,
  pickRepeat,
  pickTime,
  timeOf,
} from "@/lib/items/edit-draft";
import { LAST_DAY_OF_MONTH } from "@/constants";
import type { FieldDef, RecurringConfig } from "@/types/rules";

const LONDON = "Europe/London";
const INDIA = "Asia/Kolkata";
const NINE_AM = { hour: "9", min: "00", ampm: "am" as const };
const ALL_DAY = { hour: "", min: "00", ampm: "am" as const };
const NOW = new Date("2026-11-17T10:10:00Z");

const monthly = (anchorDay?: number): RecurringConfig => ({
  enabled: true,
  frequency: "monthly",
  interval: 1,
  endDate: null,
  anchorDay,
});
const lastDay = monthly(LAST_DAY_OF_MONTH);

describe("timeOf", () => {
  it("reads a set time from the deadline on the given clock", () => {
    expect(timeOf("2026-11-20T03:30:00.000Z", INDIA, ALL_DAY)).toEqual(NINE_AM);
  });

  it("falls back to the remembered time while the item is all day", () => {
    expect(timeOf("2026-11-20", LONDON, NINE_AM)).toBe(NINE_AM);
  });
});

describe("pickDate", () => {
  it("gives a first date the next half hour when it is today", () => {
    const picked = pickDate({ deadline: "", recurring: null }, "2026-11-17", NINE_AM, LONDON, NOW);
    expect(picked.time).toEqual({ hour: "10", min: "30", ampm: "am" });
    expect(picked.deadline).toBe("2026-11-17T10:30:00.000Z");
  });

  it("gives a first date on another day 9 am", () => {
    const picked = pickDate({ deadline: "", recurring: null }, "2026-11-20", ALL_DAY, LONDON, NOW);
    expect(picked.deadline).toBe("2026-11-20T09:00:00.000Z");
  });

  it("keeps the time when the date changes", () => {
    const time = { hour: "3", min: "15", ampm: "pm" as const };
    const picked = pickDate(
      { deadline: "2026-11-18T15:15:00.000Z", recurring: null },
      "2026-11-20",
      time,
      LONDON,
      NOW
    );
    expect(picked.deadline).toBe("2026-11-20T15:15:00.000Z");
  });

  it("keeps an all-day item all day", () => {
    const picked = pickDate(
      { deadline: "2026-11-18", recurring: null },
      "2026-11-20",
      ALL_DAY,
      LONDON,
      NOW
    );
    expect(picked.deadline).toBe("2026-11-20");
  });

  it("moves a last-day repeat to the last day of the picked month", () => {
    const picked = pickDate(
      { deadline: "2026-01-31T09:00:00.000Z", recurring: lastDay },
      "2026-02-10",
      NINE_AM,
      LONDON,
      NOW
    );
    expect(picked.deadline).toBe("2026-02-28T09:00:00.000Z");
    expect(picked.recurring).toBe(lastDay);
  });

  it("clears the date and the repeat together", () => {
    const picked = pickDate(
      { deadline: "2026-11-18T09:00:00.000Z", recurring: monthly(18) },
      "",
      NINE_AM,
      LONDON,
      NOW
    );
    expect(picked.deadline).toBe("");
    expect(picked.recurring).toBeNull();
  });
});

describe("pickTime", () => {
  it("sets the time on the date, on the given clock", () => {
    const time = { hour: "4", min: "30", ampm: "pm" as const };
    expect(pickTime("2026-11-20", time, INDIA)).toBe("2026-11-20T11:00:00.000Z");
  });

  it("leaves an empty deadline empty", () => {
    expect(pickTime("", NINE_AM, LONDON)).toBe("");
  });

  it("returns to all day when the hour is cleared", () => {
    expect(pickTime("2026-11-20T09:00:00.000Z", ALL_DAY, LONDON)).toBe("2026-11-20");
  });
});

describe("pickRepeat", () => {
  it("moves the date to the last day of its month for a last-day repeat", () => {
    const picked = pickRepeat(
      { deadline: "2026-11-10T09:00:00.000Z", recurring: null },
      lastDay,
      NINE_AM,
      LONDON
    );
    expect(picked).toEqual({ recurring: lastDay, deadline: "2026-11-30T09:00:00.000Z" });
  });

  it("leaves the date alone for any other repeat", () => {
    const deadline = "2026-11-10T09:00:00.000Z";
    const picked = pickRepeat({ deadline, recurring: null }, monthly(10), NINE_AM, LONDON);
    expect(picked.deadline).toBe(deadline);
  });

  it("leaves a missing date alone", () => {
    expect(pickRepeat({ deadline: "", recurring: null }, lastDay, NINE_AM, LONDON).deadline).toBe(
      ""
    );
  });
});

describe("firstMissingRequired", () => {
  const field = (key: string, required: boolean): FieldDef => ({
    key,
    label: key,
    type: "text",
    validation: { required },
  });
  const fields = [field("a", false), field("b", true), field("c", true)];

  it("finds the first required field that is empty", () => {
    expect(firstMissingRequired(fields, { b: "  ", c: "x" })?.key).toBe("b");
  });

  it("counts an empty list as empty", () => {
    expect(firstMissingRequired([field("b", true)], { b: [] })?.key).toBe("b");
  });

  it("returns nothing when every required field has a value", () => {
    expect(firstMissingRequired(fields, { b: "x", c: 0 })).toBeUndefined();
  });

  it("returns nothing without fields", () => {
    expect(firstMissingRequired(undefined, undefined)).toBeUndefined();
  });
});

describe("inlinePatch", () => {
  const saved = { title: "rent", deadline: "2026-11-20T09:00:00.000Z", recurring: null };

  it("is empty when nothing changed", () => {
    expect(inlinePatch(saved, { ...saved }, null)).toEqual({});
  });

  it("carries a changed title, trimmed", () => {
    expect(inlinePatch(saved, { ...saved, title: "  pay rent " }, null)).toEqual({
      title: "pay rent",
    });
  });

  it("drops an empty title so the old one stays", () => {
    expect(inlinePatch(saved, { ...saved, title: "   " }, null)).toEqual({});
  });

  it("carries a changed date with the clock it was read on", () => {
    expect(
      inlinePatch(saved, { ...saved, deadline: "2026-11-21T09:00:00.000Z" }, "Asia/Kolkata")
    ).toEqual({ deadline: "2026-11-21T09:00:00.000Z", clock: "Asia/Kolkata" });
  });

  it("sends null for a cleared date", () => {
    expect(inlinePatch(saved, { ...saved, deadline: "" }, null)).toEqual({
      deadline: null,
      clock: null,
    });
  });

  it("carries a changed repeat, including one switched off", () => {
    expect(
      inlinePatch({ ...saved, recurring: monthly(20) }, { ...saved, recurring: null }, null)
    ).toEqual({ recurring: null });
  });
});

describe("dateShortcuts", () => {
  it("counts days on the given clock, not the browser's", () => {
    const late = new Date("2026-11-17T23:30:00Z");
    expect(dateShortcuts(late, INDIA)).toEqual([
      { label: "today", value: "2026-11-18" },
      { label: "tomorrow", value: "2026-11-19" },
      { label: "next week", value: "2026-11-25" },
    ]);
    expect(dateShortcuts(late, LONDON)[0]?.value).toBe("2026-11-17");
  });
});

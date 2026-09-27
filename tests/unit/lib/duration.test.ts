import { describe, it, expect } from "vitest";
import {
  parseDurationToDate,
  parseDurationToMins,
  parseDurationToDays,
  minsToDisplayStr,
  daysToDisplayStr,
  durationPreview,
} from "@/lib/duration";

function daysFromToday(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

describe("parseDurationToDate", () => {
  it("returns null for null, undefined, and empty string", () => {
    expect(parseDurationToDate(null)).toBeNull();
    expect(parseDurationToDate(undefined)).toBeNull();
    expect(parseDurationToDate("")).toBeNull();
    expect(parseDurationToDate("  ")).toBeNull();
  });

  it("returns null for unrecognized format", () => {
    expect(parseDurationToDate("abc")).toBeNull();
    expect(parseDurationToDate("0d")).toBeNull();
    expect(parseDurationToDate("5")).toBeNull();
  });

  it("resolves 1d to tomorrow", () => {
    expect(parseDurationToDate("1d")).toBe(daysFromToday(1));
  });

  it("resolves 7d to 7 days from today", () => {
    expect(parseDurationToDate("7d")).toBe(daysFromToday(7));
  });

  it("resolves 2w to 14 days from today", () => {
    expect(parseDurationToDate("2w")).toBe(daysFromToday(14));
  });

  it("accepts aliased units (day, days, wk, wks)", () => {
    expect(parseDurationToDate("1day")).toBe(daysFromToday(1));
    expect(parseDurationToDate("3days")).toBe(daysFromToday(3));
    expect(parseDurationToDate("1wk")).toBe(daysFromToday(7));
    expect(parseDurationToDate("2wks")).toBe(daysFromToday(14));
  });
});

describe("parseDurationToMins", () => {
  it("returns null for empty/null/undefined", () => {
    expect(parseDurationToMins(null)).toBeNull();
    expect(parseDurationToMins(undefined)).toBeNull();
    expect(parseDurationToMins("")).toBeNull();
  });

  it("returns null for unrecognized input", () => {
    expect(parseDurationToMins("xyz")).toBeNull();
    expect(parseDurationToMins("0h")).toBeNull();
  });

  it("converts hours", () => {
    expect(parseDurationToMins("1h")).toBe(60);
    expect(parseDurationToMins("2hr")).toBe(120);
    expect(parseDurationToMins("3hrs")).toBe(180);
    expect(parseDurationToMins("1hour")).toBe(60);
    expect(parseDurationToMins("2hours")).toBe(120);
  });

  it("converts days", () => {
    expect(parseDurationToMins("1d")).toBe(1440);
    expect(parseDurationToMins("3days")).toBe(4320);
  });

  it("converts weeks", () => {
    expect(parseDurationToMins("1w")).toBe(10080);
    expect(parseDurationToMins("2wks")).toBe(20160);
  });

  it("converts months as 30 days", () => {
    expect(parseDurationToMins("1m")).toBe(30 * 24 * 60);
    expect(parseDurationToMins("2mo")).toBe(2 * 30 * 24 * 60);
  });
});

describe("parseDurationToDays", () => {
  it("returns null for empty/null/undefined", () => {
    expect(parseDurationToDays(null)).toBeNull();
    expect(parseDurationToDays(undefined)).toBeNull();
    expect(parseDurationToDays("")).toBeNull();
  });

  it("returns null for hours (sub-day granularity)", () => {
    expect(parseDurationToDays("2h")).toBeNull();
    expect(parseDurationToDays("24h")).toBeNull();
  });

  it("returns null for unrecognized input", () => {
    expect(parseDurationToDays("abc")).toBeNull();
  });

  it("converts days", () => {
    expect(parseDurationToDays("1d")).toBe(1);
    expect(parseDurationToDays("30d")).toBe(30);
  });

  it("converts weeks to days", () => {
    expect(parseDurationToDays("1w")).toBe(7);
    expect(parseDurationToDays("2w")).toBe(14);
  });

  it("converts months to 30-day approximation", () => {
    expect(parseDurationToDays("1m")).toBe(30);
    expect(parseDurationToDays("2m")).toBe(60);
  });
});

describe("minsToDisplayStr", () => {
  it("returns empty string for zero and negative values", () => {
    expect(minsToDisplayStr(0)).toBe("");
    expect(minsToDisplayStr(-60)).toBe("");
  });

  it("displays minutes when not divisible by 60", () => {
    expect(minsToDisplayStr(45)).toBe("45 minutes");
    expect(minsToDisplayStr(1)).toBe("1 minute");
  });

  it("displays hours", () => {
    expect(minsToDisplayStr(60)).toBe("1 hour");
    expect(minsToDisplayStr(120)).toBe("2 hours");
  });

  it("displays days", () => {
    expect(minsToDisplayStr(1440)).toBe("1 day");
    expect(minsToDisplayStr(4320)).toBe("3 days");
  });

  it("displays weeks", () => {
    expect(minsToDisplayStr(7 * 24 * 60)).toBe("1 week");
    expect(minsToDisplayStr(14 * 24 * 60)).toBe("2 weeks");
  });

  it("displays months", () => {
    expect(minsToDisplayStr(30 * 24 * 60)).toBe("1 month");
    expect(minsToDisplayStr(60 * 24 * 60)).toBe("2 months");
  });
});

describe("daysToDisplayStr", () => {
  it("returns empty string for zero and negative values", () => {
    expect(daysToDisplayStr(0)).toBe("");
    expect(daysToDisplayStr(-7)).toBe("");
  });

  it("displays individual days", () => {
    expect(daysToDisplayStr(1)).toBe("1 day");
    expect(daysToDisplayStr(6)).toBe("6 days");
  });

  it("displays weeks", () => {
    expect(daysToDisplayStr(7)).toBe("1 week");
    expect(daysToDisplayStr(14)).toBe("2 weeks");
  });

  it("displays months", () => {
    expect(daysToDisplayStr(30)).toBe("1 month");
    expect(daysToDisplayStr(60)).toBe("2 months");
  });
});

describe("durationPreview", () => {
  it("returns empty for blank input", () => {
    expect(durationPreview("")).toEqual({ text: "", valid: true });
    expect(durationPreview("   ")).toEqual({ text: "", valid: true });
  });

  it("marks unrecognized format as invalid", () => {
    expect(durationPreview("abc")).toEqual({ text: "unrecognized format", valid: false });
    expect(durationPreview("0d")).toEqual({ text: "unrecognized format", valid: false });
  });

  it("shows singular day", () => {
    expect(durationPreview("1d")).toEqual({ text: "→ 1 day from today", valid: true });
  });

  it("shows plural days", () => {
    expect(durationPreview("5d")).toEqual({ text: "→ 5 days from today", valid: true });
  });

  it("shows singular week", () => {
    expect(durationPreview("1w")).toEqual({ text: "→ 1 week from today", valid: true });
  });

  it("shows plural weeks", () => {
    expect(durationPreview("2w")).toEqual({ text: "→ 2 weeks from today", valid: true });
  });

  it("shows singular month", () => {
    expect(durationPreview("1m")).toEqual({ text: "→ 1 month from today", valid: true });
  });

  it("shows plural months", () => {
    expect(durationPreview("2m")).toEqual({ text: "→ 2 months from today", valid: true });
  });

  it("shows singular hour", () => {
    expect(durationPreview("1h")).toEqual({ text: "→ 1 hour from now", valid: true });
  });

  it("shows plural hours", () => {
    expect(durationPreview("3h")).toEqual({ text: "→ 3 hours from now", valid: true });
  });

  it("accepts verbose aliases", () => {
    expect(durationPreview("1day")).toEqual({ text: "→ 1 day from today", valid: true });
    expect(durationPreview("2weeks")).toEqual({ text: "→ 2 weeks from today", valid: true });
    expect(durationPreview("1hour")).toEqual({ text: "→ 1 hour from now", valid: true });
  });
});

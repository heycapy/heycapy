import { describe, it, expect } from "vitest";
import { toH24, toH12, buildDeadline, lastDayOfMonth } from "@/lib/time";

describe("toH24", () => {
  it("converts 12am to 0", () => expect(toH24(12, "am")).toBe(0));
  it("converts 1am to 1", () => expect(toH24(1, "am")).toBe(1));
  it("converts 11am to 11", () => expect(toH24(11, "am")).toBe(11));
  it("converts 12pm to 12", () => expect(toH24(12, "pm")).toBe(12));
  it("converts 1pm to 13", () => expect(toH24(1, "pm")).toBe(13));
  it("converts 11pm to 23", () => expect(toH24(11, "pm")).toBe(23));
});

describe("toH12", () => {
  it("converts 0 to 12am", () => expect(toH12(0)).toEqual({ hour: "12", ampm: "am" }));
  it("converts 1 to 1am", () => expect(toH12(1)).toEqual({ hour: "1", ampm: "am" }));
  it("converts 11 to 11am", () => expect(toH12(11)).toEqual({ hour: "11", ampm: "am" }));
  it("converts 12 to 12pm", () => expect(toH12(12)).toEqual({ hour: "12", ampm: "pm" }));
  it("converts 13 to 1pm", () => expect(toH12(13)).toEqual({ hour: "1", ampm: "pm" }));
  it("converts 23 to 11pm", () => expect(toH12(23)).toEqual({ hour: "11", ampm: "pm" }));
});

describe("toH24 / toH12 roundtrip", () => {
  const hours = [0, 1, 6, 9, 11, 12, 13, 18, 23];
  for (const h24 of hours) {
    it(`roundtrips h24=${h24}`, () => {
      const { hour, ampm } = toH12(h24);
      expect(toH24(Number(hour), ampm)).toBe(h24);
    });
  }
});

describe("buildDeadline", () => {
  it("returns empty string when date is empty", () => {
    expect(buildDeadline("", "9", "00", "am")).toBe("");
  });

  it("returns date only when hour is empty", () => {
    expect(buildDeadline("2026-09-27", "", "00", "am")).toBe("2026-09-27");
  });

  it("returns date only when hour is whitespace", () => {
    expect(buildDeadline("2026-09-27", "  ", "00", "am")).toBe("2026-09-27");
  });

  it("builds correct timestamp for 9am", () => {
    const result = buildDeadline("2026-09-27", "9", "00", "am");
    expect(new Date(result).getTime()).toBe(new Date("2026-09-27T09:00:00").getTime());
  });

  it("builds correct timestamp for 3:30pm", () => {
    const result = buildDeadline("2026-09-27", "3", "30", "pm");
    expect(new Date(result).getTime()).toBe(new Date("2026-09-27T15:30:00").getTime());
  });

  it("handles 12pm (noon) correctly", () => {
    const result = buildDeadline("2026-09-27", "12", "00", "pm");
    expect(new Date(result).getTime()).toBe(new Date("2026-09-27T12:00:00").getTime());
  });

  it("handles 12am (midnight) correctly", () => {
    const result = buildDeadline("2026-09-27", "12", "00", "am");
    expect(new Date(result).getTime()).toBe(new Date("2026-09-27T00:00:00").getTime());
  });

  it("pads single-digit minutes", () => {
    const result = buildDeadline("2026-09-27", "9", "05", "am");
    expect(new Date(result).getTime()).toBe(new Date("2026-09-27T09:05:00").getTime());
  });
});

describe("lastDayOfMonth", () => {
  it("handles short months, leap years and December", () => {
    expect(lastDayOfMonth("2026-09-21")).toBe("2026-09-30");
    expect(lastDayOfMonth("2028-02-10")).toBe("2028-02-29");
    expect(lastDayOfMonth("2026-02-10")).toBe("2026-02-28");
    expect(lastDayOfMonth("2026-12-05")).toBe("2026-12-31");
  });
});

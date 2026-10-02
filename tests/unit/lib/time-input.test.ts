import { describe, expect, it } from "vitest";
import { formatTypedTime, parseTimeInput } from "@/lib/time-input";

describe("parseTimeInput", () => {
  it("reads the ways people type times", () => {
    expect(parseTimeInput("9 am")).toBe("09:00");
    expect(parseTimeInput("9am")).toBe("09:00");
    expect(parseTimeInput("9:37pm")).toBe("21:37");
    expect(parseTimeInput("9:37 p")).toBe("21:37");
    expect(parseTimeInput("12 am")).toBe("00:00");
    expect(parseTimeInput("12:15 pm")).toBe("12:15");
    expect(parseTimeInput("14:00")).toBe("14:00");
    expect(parseTimeInput("1430")).toBe("14:30");
    expect(parseTimeInput("7")).toBe("07:00");
  });

  it("gives empty for nothing and null for nonsense", () => {
    expect(parseTimeInput("  ")).toBe("");
    for (const bad of ["25:00", "9:75", "13pm", "0 am", "noon", "14:00 pm"]) {
      expect(parseTimeInput(bad)).toBeNull();
    }
  });
});

describe("formatTypedTime", () => {
  it("adds the colon as soon as the hour is complete", () => {
    expect(formatTypedTime("9")).toBe("9:");
    expect(formatTypedTime("93")).toBe("9:3");
    expect(formatTypedTime("930")).toBe("9:30");
    expect(formatTypedTime("1")).toBe("1");
    expect(formatTypedTime("10")).toBe("10:");
    expect(formatTypedTime("1045")).toBe("10:45");
    expect(formatTypedTime("0915")).toBe("09:15");
    expect(formatTypedTime("14")).toBe("14:");
  });

  it("adds am or pm from a typed a or p", () => {
    expect(formatTypedTime("930p")).toBe("9:30 pm");
    expect(formatTypedTime("9p")).toBe("9 pm");
    expect(formatTypedTime("1030a")).toBe("10:30 am");
  });

  it("leaves already formatted text as it is, and ignores anything else", () => {
    expect(formatTypedTime("9:30 pm")).toBe("9:30 pm");
    expect(formatTypedTime("93012")).toBe("9:30");
    expect(formatTypedTime("x")).toBe("");
  });

  it("the result reads back as the intended time", () => {
    expect(parseTimeInput(formatTypedTime("9"))).toBe("09:00");
    expect(parseTimeInput(formatTypedTime("930p"))).toBe("21:30");
    expect(parseTimeInput(formatTypedTime("1415"))).toBe("14:15");
  });
});

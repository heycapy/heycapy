import { describe, expect, it } from "vitest";
import { placeName } from "@/lib/timezones/place";

describe("placeName", () => {
  it("names a country on one clock, short when it has a common short name", () => {
    expect(placeName("Asia/Kolkata")).toBe("India");
    expect(placeName("Asia/Calcutta")).toBe("India");
    expect(placeName("Europe/London")).toBe("UK");
    expect(placeName("Asia/Dubai")).toBe("UAE");
  });

  it("names the city for a country on several clocks", () => {
    expect(placeName("America/New_York")).toBe("New York");
    expect(placeName("Australia/Sydney")).toBe("Sydney");
  });

  it("is null for the timezone nobody has set yet", () => {
    expect(placeName("UTC")).toBeNull();
  });
});

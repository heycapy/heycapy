import { describe, expect, it } from "vitest";
import { placesOf, timeGap } from "@/lib/timezones/gap";

const INDIA = "Asia/Kolkata";
const LONDON = "Europe/London";

describe("timeGap", () => {
  it("follows the UK clock change on 25 Oct 2026", () => {
    expect(timeGap(LONDON, INDIA, new Date("2026-10-24T12:00:00Z"))).toBe("4:30 h behind you");
    expect(timeGap(LONDON, INDIA, new Date("2026-10-26T12:00:00Z"))).toBe("5:30 h behind you");
    expect(timeGap(INDIA, LONDON, new Date("2026-10-26T12:00:00Z"))).toBe("5:30 h ahead of you");
  });

  it("leaves whole hours without minutes", () => {
    expect(timeGap("Europe/Berlin", LONDON, new Date("2026-10-26T12:00:00Z"))).toBe(
      "1 h ahead of you"
    );
  });

  it("says nothing when the clocks match or one isn't set", () => {
    expect(timeGap(INDIA, "Asia/Calcutta", new Date())).toBeNull();
    expect(timeGap("UTC", INDIA, new Date())).toBeNull();
  });
});

describe("placesOf", () => {
  it("lists each place once and counts a missing timezone as different", () => {
    expect(placesOf([{ place: "India" }, { place: "UK" }, { place: "India" }])).toEqual({
      places: ["India", "UK"],
      differ: true,
    });
    expect(placesOf([{ place: "India" }, { place: null }])).toEqual({
      places: ["India"],
      differ: true,
    });
    expect(placesOf([{ place: "India" }, { place: "India" }])).toEqual({
      places: ["India"],
      differ: false,
    });
  });
});

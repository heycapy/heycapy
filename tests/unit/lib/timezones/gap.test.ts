import { describe, expect, it } from "vitest";
import { otherClock, placesOf, timeGap } from "@/lib/timezones/gap";

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

describe("otherClock", () => {
  const sam = { name: "Sam", timezone: LONDON, isYou: false };
  const setInIndia = { timezone: INDIA, place: "India" };
  const before = new Date("2026-10-24T09:00:00Z");
  const after = new Date("2026-10-26T09:00:00Z");

  it("gives the time for the person it's assigned to, on their clock", () => {
    expect(otherClock(before, INDIA, sam, setInIndia)).toBe("10am for Sam");
    expect(otherClock(after, INDIA, sam, setInIndia)).toBe("9am for Sam");
  });

  it("else gives the time on the clock it was set on", () => {
    expect(otherClock(after, LONDON, { ...sam, isYou: true }, setInIndia)).toBe("2:30pm India");
    expect(otherClock(after, LONDON, undefined, setInIndia)).toBe("2:30pm India");
  });

  it("says nothing when every clock involved is yours", () => {
    expect(otherClock(after, INDIA, { ...sam, timezone: INDIA }, setInIndia)).toBeNull();
    expect(otherClock(after, INDIA, { ...sam, timezone: "UTC" }, setInIndia)).toBeNull();
    expect(otherClock(after, LONDON, undefined, undefined)).toBeNull();
  });
});

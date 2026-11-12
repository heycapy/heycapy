import { describe, it, expect } from "vitest";
import { bucketAt, currentPlace, stepPlace } from "@/lib/keybinds/navigate";

describe("currentPlace", () => {
  it("is today whenever today is open", () => {
    expect(currentPlace([4, 5], 5, true)).toBe("today");
  });

  it("is the active bucket, or the first when it is gone or unset", () => {
    expect(currentPlace([4, 5], 5, false)).toBe(5);
    expect(currentPlace([4, 5], 9, false)).toBe(4);
    expect(currentPlace([4, 5], null, false)).toBe(4);
  });

  it("is today when there are no buckets", () => {
    expect(currentPlace([], null, false)).toBe("today");
  });
});

describe("stepPlace", () => {
  it("walks today then the buckets in tab order", () => {
    expect(stepPlace([4, 5], "today", 1)).toBe(4);
    expect(stepPlace([4, 5], 4, 1)).toBe(5);
    expect(stepPlace([4, 5], 5, -1)).toBe(4);
    expect(stepPlace([4, 5], 4, -1)).toBe("today");
  });

  it("wraps at both ends", () => {
    expect(stepPlace([4, 5], 5, 1)).toBe("today");
    expect(stepPlace([4, 5], "today", -1)).toBe(5);
  });

  it("stays on today with no buckets, and starts at today from an unknown place", () => {
    expect(stepPlace([], "today", 1)).toBe("today");
    expect(stepPlace([4, 5], 99, 1)).toBe("today");
  });
});

describe("bucketAt", () => {
  it("counts from 1 in tab order and is null past the end", () => {
    expect(bucketAt([4, 5], 1)).toBe(4);
    expect(bucketAt([4, 5], 2)).toBe(5);
    expect(bucketAt([4, 5], 3)).toBeNull();
  });
});

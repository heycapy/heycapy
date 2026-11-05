import { describe, expect, it } from "vitest";
import { countPlaces } from "@/components/buckets/place-counts";

// Local times, like the browser sees them
const NOW = new Date(2026, 10, 5, 15, 0);
const at = (days: number, hour = 12) => new Date(2026, 10, 5 + days, hour, 0);
const open = (bucketId: number, deadline: Date | null) => ({
  bucketId,
  deadline,
  deadlineTimezone: null,
});

describe("countPlaces", () => {
  it("counts each bucket's open and late items, and what today shows", () => {
    const counts = countPlaces(
      [
        open(1, at(-2)),
        open(1, at(0, 9)),
        open(1, at(0, 20)),
        open(1, at(3)),
        open(1, null),
        open(2, at(1)),
      ],
      NOW
    );
    expect(counts.buckets).toEqual({ 1: { open: 5, late: 2 }, 2: { open: 1, late: 0 } });
    expect(counts.today).toBe(3);
  });

  it("an all-day item is due all of today, not late", () => {
    const counts = countPlaces([open(1, at(0, 0))], NOW);
    expect(counts.buckets[1]).toEqual({ open: 1, late: 0 });
    expect(counts.today).toBe(1);
  });

  it("has nothing for a bucket with no open items", () => {
    expect(countPlaces([], NOW)).toEqual({ today: 0, buckets: {} });
  });
});

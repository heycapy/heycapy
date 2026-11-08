import { describe, expect, it } from "vitest";
import { lateBucketIds } from "@/components/buckets/late-buckets";

// Local times, like the browser sees them
const NOW = new Date(2026, 10, 5, 15, 0);
const at = (days: number, hour = 12) => new Date(2026, 10, 5 + days, hour, 0);
const open = (bucketId: number, deadline: Date | null) => ({
  bucketId,
  deadline,
  deadlineTimezone: null,
});

describe("lateBucketIds", () => {
  it("has the buckets with an item past its deadline", () => {
    const late = lateBucketIds(
      [open(1, at(-2)), open(1, at(3)), open(2, at(0, 9)), open(3, at(0, 20)), open(4, null)],
      NOW
    );
    expect([...late].sort()).toEqual([1, 2]);
  });

  it("an all-day item is due all of today, not late", () => {
    expect(lateBucketIds([open(1, at(0, 0))], NOW).size).toBe(0);
  });

  it("is empty with no open items", () => {
    expect(lateBucketIds([], NOW).size).toBe(0);
  });
});

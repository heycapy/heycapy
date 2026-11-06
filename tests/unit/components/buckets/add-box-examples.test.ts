import { describe, expect, it } from "vitest";
import { ADD_BOX_EXAMPLES, ADD_BOX_EXAMPLES_SHORT } from "@/components/buckets/constants";
import { findTitleDate } from "@/lib/items/title-date";

describe("add box examples", () => {
  it.each([...ADD_BOX_EXAMPLES, ...ADD_BOX_EXAMPLES_SHORT])(
    "%s reads as a title with a date",
    (example) => {
      const found = findTitleDate(example, new Date(2026, 10, 6, 9, 0));
      expect(found).not.toBeNull();
      expect(found?.title.length).toBeGreaterThan(0);
    }
  );

  it("has a short note for each long one, in the same order", () => {
    expect(ADD_BOX_EXAMPLES_SHORT).toHaveLength(ADD_BOX_EXAMPLES.length);
    for (const example of ADD_BOX_EXAMPLES_SHORT) expect(example.length).toBeLessThanOrEqual(21);
  });
});

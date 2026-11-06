import { describe, expect, it } from "vitest";
import { ADD_BOX_EXAMPLES } from "@/components/buckets/constants";
import { findTitleDate } from "@/lib/items/title-date";

describe("add box examples", () => {
  it.each(ADD_BOX_EXAMPLES)("%s reads as a title with a date", (example) => {
    const found = findTitleDate(example, new Date(2026, 10, 6, 9, 0));
    expect(found).not.toBeNull();
    expect(found?.title.length).toBeGreaterThan(0);
  });
});

import { describe, it, expect } from "vitest";
import { cheatSheetRows } from "@/lib/keybinds/cheat-sheet";
import { defaultBindings, mergeBindings } from "@/lib/keybinds/match";

describe("cheatSheetRows", () => {
  it("lists every action once, with the bucket numbers on one row", () => {
    const rows = cheatSheetRows(defaultBindings());
    const buckets = rows.filter((r) => r.label.startsWith("bucket"));
    expect(buckets).toContainEqual({
      label: "bucket by tab order",
      key: "1-9",
    });
    expect(buckets.map((r) => r.label)).toEqual(["bucket by tab order", "bucket settings"]);
    expect(rows.map((r) => r.label)).toContain("quick add");
    expect(rows.map((r) => r.label)).toContain("cheat sheet");
  });

  it("shows the key an action is bound to now", () => {
    const rows = cheatSheetRows(mergeBindings({ "quick-add": "q" }));
    expect(rows.find((r) => r.label === "quick add")?.key).toBe("q");
  });

  it("ends with Escape", () => {
    expect(cheatSheetRows(defaultBindings()).at(-1)).toEqual({
      label: "close whatever is open",
      key: "Esc",
    });
  });
});

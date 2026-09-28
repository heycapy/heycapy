import { describe, expect, it } from "vitest";
import { groupForToday } from "@/components/today/group";
import type { items } from "@/lib/db/schema";

type Item = typeof items.$inferSelect;

// Local times, like the browser sees them
const NOW = new Date(2026, 8, 29, 15, 0);
const at = (days: number, hour = 12) => new Date(2026, 8, 29 + days, hour, 0);
const item = (title: string, deadline: Date | null) => ({ title, deadline }) as unknown as Item;

describe("groupForToday", () => {
  it("splits overdue, today and each upcoming day, in the list's order", () => {
    const sections = groupForToday(
      [
        item("yesterday", at(-1)),
        item("this morning", at(0, 9)),
        item("tonight", at(0, 20)),
        item("all day today", at(0, 0)),
        item("tomorrow", at(1)),
        item("thursday", at(2)),
        item("in a week", at(7)),
        item("too far", at(8)),
        item("undated", null),
      ],
      NOW
    );
    expect(sections.map((s) => [s.label, s.items.map((i) => i.title)])).toEqual([
      ["overdue", ["yesterday", "this morning"]],
      ["today", ["tonight", "all day today"]],
      ["tomorrow", ["tomorrow"]],
      ["thu oct 1", ["thursday"]],
      ["tue oct 6", ["in a week"]],
    ]);
  });
});

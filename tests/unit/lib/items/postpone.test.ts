import { describe, expect, it } from "vitest";
import { postponeDeadline } from "@/lib/items/postpone";

const NOW = new Date("2026-03-10T12:00:00Z");

describe("postponeDeadline", () => {
  it("moves an overdue item to days after today, keeping its time", () => {
    const lastWeek = new Date("2026-03-03T09:00:00Z");
    expect(postponeDeadline(lastWeek, 1, NOW, "UTC")).toEqual(new Date("2026-03-11T09:00:00Z"));
  });

  it("moves an upcoming item from its own date", () => {
    const friday = new Date("2026-03-13T09:00:00Z");
    expect(postponeDeadline(friday, 2, NOW, "UTC")).toEqual(new Date("2026-03-15T09:00:00Z"));
  });

  it("keeps the local time of day across a DST change", () => {
    // 9:00 EST on Mar 7; clocks moved forward on Mar 8, so 9:00 EDT is 13:00 UTC
    const beforeDst = new Date("2026-03-07T14:00:00Z");
    expect(postponeDeadline(beforeDst, 1, NOW, "America/New_York")).toEqual(
      new Date("2026-03-11T13:00:00Z")
    );
  });
});

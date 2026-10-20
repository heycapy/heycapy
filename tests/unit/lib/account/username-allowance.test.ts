import { describe, expect, it } from "vitest";
import { allowanceLine, canChangeUsername, renameWarning } from "@/lib/account/username-allowance";

const NEXT = new Date("2026-11-18T12:00:00Z");
const allowance = (used: number, bonus: number, nextFreeAt: Date | null = null) => ({
  used,
  limit: 2,
  bonus,
  nextFreeAt,
});

describe("allowanceLine", () => {
  it("counts the monthly changes, then the bonus", () => {
    expect(allowanceLine(allowance(0, 0))).toBe("2 of 2 changes left this month");
    expect(allowanceLine(allowance(1, 1))).toBe("1 of 2 changes left this month, then 1 bonus");
  });

  it("names the bonus changes once the month is used up, else when the next one opens", () => {
    expect(allowanceLine(allowance(2, 1, NEXT))).toBe(
      "no monthly changes left · 1 bonus change left"
    );
    expect(allowanceLine(allowance(2, 3, NEXT))).toBe(
      "no monthly changes left · 3 bonus changes left"
    );
    expect(allowanceLine(allowance(2, 0, NEXT))).toBe(
      "no changes left · the next one opens on Nov 18"
    );
  });
});

describe("canChangeUsername", () => {
  it("is false only with the month used up and no bonus", () => {
    expect(canChangeUsername(allowance(1, 0))).toBe(true);
    expect(canChangeUsername(allowance(2, 1, NEXT))).toBe(true);
    expect(canChangeUsername(allowance(2, 0, NEXT))).toBe(false);
  });
});

describe("renameWarning", () => {
  it("asks only before the last monthly change or a bonus one", () => {
    expect(renameWarning("sam", allowance(0, 0))).toBeNull();
    expect(renameWarning("sam", allowance(1, 0))).toBe(
      "rename to sam? that's your last change this month"
    );
    expect(renameWarning("sam", allowance(2, 2, NEXT))).toBe(
      "rename to sam? this uses 1 of your 2 bonus changes"
    );
    expect(renameWarning("sam", allowance(2, 0, NEXT))).toBeNull();
  });
});

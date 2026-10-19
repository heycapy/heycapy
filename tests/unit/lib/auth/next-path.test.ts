import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/next-path";

describe("safeNextPath", () => {
  it("lets login return to a join page", () => {
    expect(safeNextPath("/join/ABCD2345")).toBe("/join/ABCD2345");
  });

  it("sends everything else to the home page", () => {
    for (const unsafe of [
      null,
      "",
      "/",
      "/settings",
      "https://evil.example/join/ABCD2345",
      "//evil.example/join/ABCD2345",
      "/join/",
      "/join/ABCD/extra",
      "/join/ABCD?x=1",
      "/join/../etc",
      `/join/${"A".repeat(65)}`,
    ]) {
      expect(safeNextPath(unsafe)).toBe("/");
    }
  });
});

import { describe, expect, it } from "vitest";
import { normalizeUsername, usernameProblem } from "@/lib/account/username-rules";

describe("normalizeUsername", () => {
  it("trims and lowercases", () => {
    expect(normalizeUsername("  Sam_Writes ")).toBe("sam_writes");
  });
});

describe("usernameProblem", () => {
  it("allows lowercase letters, numbers and _ from 3 to 32 characters", () => {
    expect(usernameProblem("sam")).toBeNull();
    expect(usernameProblem("sam_2026")).toBeNull();
    expect(usernameProblem("a".repeat(32))).toBeNull();
  });

  it("allows every generated name, the longest is 32", () => {
    expect(usernameProblem("earnest_chameleon_daydreaming_99")).toBeNull();
  });

  it("refuses names that are too short or too long", () => {
    expect(usernameProblem("ab")).toBe("a username needs at least 3 characters");
    expect(usernameProblem("a".repeat(33))).toBe("a username can be at most 32 characters");
  });

  it("refuses anything but lowercase letters, numbers and _", () => {
    for (const name of ["sam-writes", "sam writes", "sam.w", "Sam", "sám", "sam@x"]) {
      expect(usernameProblem(name)).toBe("only letters, numbers and _");
    }
  });

  it("refuses reserved words and anything starting with heycapy, but not names that contain them", () => {
    for (const name of ["anyone", "you", "admin", "support", "capy", "null"]) {
      expect(usernameProblem(name)).toBe("that username is reserved");
    }
    expect(usernameProblem("heycapy_help")).toBe("that username is reserved");
    expect(usernameProblem("capybara_fan")).toBeNull();
    expect(usernameProblem("admin_of_my_life")).toBeNull();
  });
});

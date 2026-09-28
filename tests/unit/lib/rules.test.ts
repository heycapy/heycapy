import { describe, expect, it } from "vitest";
import { bucketChannels, parseItemsRules, parseNotificationRules } from "@/lib/rules";

describe("rules helpers", () => {
  it("fall back to defaults for missing or malformed rules", () => {
    expect(parseNotificationRules(null).medium).toEqual([]);
    expect(parseNotificationRules("{nope").repeat).toBe("once");
    expect(parseItemsRules("{nope")).toEqual({});
  });

  it("read the bucket's channels", () => {
    expect(bucketChannels(JSON.stringify({ medium: ["telegram", "email"] }))).toEqual([
      "telegram",
      "email",
    ]);
  });

  it("understand the older sort_by key", () => {
    expect(parseItemsRules(JSON.stringify({ sort_by: "manual" })).sortBy).toBe("manual");
    expect(parseItemsRules(JSON.stringify({ sortBy: "deadline" })).sortBy).toBe("deadline");
  });
});

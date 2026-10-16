import { describe, expect, it } from "vitest";
import { memberChannels, parseItemsRules, parseNotificationRules } from "@/lib/rules";

describe("rules helpers", () => {
  it("fall back to defaults for missing or malformed rules", () => {
    expect(parseNotificationRules(null).defaultReminders).toEqual([0]);
    expect(memberChannels("{nope")).toEqual({ medium: [], webhooks: [] });
    expect(parseNotificationRules("{nope").repeat).toBe("once");
    expect(parseItemsRules("{nope")).toEqual({});
  });

  it("read a member's channels and webhooks", () => {
    expect(memberChannels(JSON.stringify({ medium: ["telegram", "email"] }))).toEqual({
      medium: ["telegram", "email"],
      webhooks: [],
    });
    expect(memberChannels(JSON.stringify({ medium: [], webhooks: [3, 7] }))).toEqual({
      medium: [],
      webhooks: [3, 7],
    });
    expect(memberChannels(JSON.stringify({ medium: ["sms"] }))).toEqual({
      medium: [],
      webhooks: [],
    });
  });

  it("understand the older sort_by key", () => {
    expect(parseItemsRules(JSON.stringify({ sort_by: "manual" })).sortBy).toBe("manual");
    expect(parseItemsRules(JSON.stringify({ sortBy: "deadline" })).sortBy).toBe("deadline");
  });
});

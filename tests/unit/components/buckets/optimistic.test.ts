import { describe, it, expect } from "vitest";
import { withPatch } from "@/components/buckets/optimistic";
import type { ListItem } from "@/lib/reminders/status";

const item = {
  id: "0193f5a0-0000-7000-8000-000000000001",
  title: "rent",
  deadline: new Date("2026-11-20T09:00:00Z"),
  deadlineTimezone: "Asia/Kolkata",
  recurring: JSON.stringify({ enabled: true, frequency: "monthly" }),
} as ListItem;

describe("withPatch", () => {
  it("changes only what the patch names", () => {
    const next = withPatch(item, { title: "pay rent" });
    expect(next.title).toBe("pay rent");
    expect(next.deadline).toBe(item.deadline);
    expect(next.recurring).toBe(item.recurring);
  });

  it("reads a new time on the clock it was set on", () => {
    const next = withPatch(item, { deadline: "2026-11-21T09:00:00.000Z", clock: "Europe/London" });
    expect(next.deadline?.toISOString()).toBe("2026-11-21T09:00:00.000Z");
    expect(next.deadlineTimezone).toBe("Europe/London");
  });

  it("clears the date and its clock together", () => {
    const next = withPatch(item, { deadline: null });
    expect(next.deadline).toBeNull();
    expect(next.deadlineTimezone).toBeNull();
  });

  it("turns the repeat off", () => {
    expect(withPatch(item, { recurring: null }).recurring).toBeNull();
  });

  it("applies status, reminders, assignees and fields", () => {
    const next = withPatch(item, {
      status: "completed",
      reminders: [60],
      assigneeIds: [3],
      properties: { amount: 4 },
    });
    expect(next.status).toBe("completed");
    expect(next.reminderOffsets).toEqual([60]);
    expect(next.assigneeIds).toEqual([3]);
    expect(next.properties).toBe('{"amount":4}');
  });

  it("applies notes and clears them with null", () => {
    expect(withPatch(item, { description: "call first" }).description).toBe("call first");
    expect(withPatch({ ...item, description: "x" }, { description: null }).description).toBeNull();
  });

  it("clears fields with null", () => {
    expect(withPatch(item, { properties: null }).properties).toBeNull();
  });

  it("does not touch the item it was given", () => {
    withPatch(item, { title: "other" });
    expect(item.title).toBe("rent");
  });
});

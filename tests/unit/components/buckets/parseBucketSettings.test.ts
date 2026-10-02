import { describe, it, expect } from "vitest";
import { parseBucketSettings } from "@/components/buckets/parseBucketSettings";
import type { buckets } from "@/lib/db/schema";

type BucketRow = typeof buckets.$inferSelect;

function bucket(overrides: Partial<BucketRow>): BucketRow {
  return {
    name: "Bills",
    itemsRules: "{}",
    notificationsRules: "{}",
    fieldSchema: null,
    ...overrides,
  } as BucketRow;
}

describe("parseBucketSettings", () => {
  it("falls back to defaults for empty rules", () => {
    expect(parseBucketSettings(bucket({}))).toEqual({
      name: "Bills",
      recurrenceMode: "wait",
      sortBy: "created_at",
      drag: false,
      showCompleted: true,
      readonly: false,
      defaultDeadlineOffset: "",
      mediums: [],
      webhooks: [],
      reminderButtons: ["60", "tomorrow"],
      notifyAt: "",
      defaultReminders: [0],
      repeat: "once",
      notifyOnArrival: false,
      notifyWhenOverdue: false,
      overdueRepeatHours: undefined,
    });
  });

  it("reads current camelCase rules", () => {
    const values = parseBucketSettings(
      bucket({
        itemsRules: JSON.stringify({
          sortBy: "manual",
          drag: true,
          showCompleted: false,
          readonly: true,
          defaultDeadlineOffsetDays: 14,
        }),
        notificationsRules: JSON.stringify({
          medium: ["email", "telegram"],
          notifyAt: "08:15",
          defaultReminders: [1440, 180],
          repeat: "daily",
        }),
      })
    );
    expect(values).toMatchObject({
      sortBy: "manual",
      drag: true,
      showCompleted: false,
      readonly: true,
      defaultDeadlineOffset: "2 weeks",
      mediums: ["email", "telegram"],
      notifyAt: "08:15",
      defaultReminders: [1440, 180],
      repeat: "daily",
    });
  });

  it("reads legacy snake_case rules", () => {
    const values = parseBucketSettings(
      bucket({
        itemsRules: JSON.stringify({
          sort_by: "deadline",
          show_completed: false,
          default_deadline_offset: "3 days",
        }),
        notificationsRules: JSON.stringify({ notify_at: "09:00" }),
      })
    );
    expect(values).toMatchObject({
      sortBy: "deadline",
      showCompleted: false,
      defaultDeadlineOffset: "3 days",
      notifyAt: "09:00",
    });
  });

  it("reads notification triggers from the field schema as string or object", () => {
    const triggers = { notifyOnArrival: true, notifyWhenOverdue: true, overdueRepeatHours: 2 };
    const expected = { notifyOnArrival: true, notifyWhenOverdue: true, overdueRepeatHours: 2 };
    expect(
      parseBucketSettings(bucket({ fieldSchema: JSON.stringify(triggers) as never }))
    ).toMatchObject(expected);
    expect(parseBucketSettings(bucket({ fieldSchema: triggers as never }))).toMatchObject(expected);
  });

  it("survives corrupt JSON", () => {
    const values = parseBucketSettings(
      bucket({ itemsRules: "{not json", notificationsRules: "", fieldSchema: "nope" as never })
    );
    expect(values.sortBy).toBe("created_at");
    expect(values.mediums).toEqual([]);
    expect(values.notifyOnArrival).toBe(false);
  });

  it("reads the repeating items mode", () => {
    const values = parseBucketSettings(
      bucket({ itemsRules: JSON.stringify({ recurrenceMode: "moveOn" }) })
    );
    expect(values.recurrenceMode).toBe("moveOn");
  });
});

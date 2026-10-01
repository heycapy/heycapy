import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { executeToolCall } from "@/lib/ai/capyTools";
import {
  HOUR,
  resetSchedulerEnvironment,
  seedBucket,
  seedItem,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

const T0 = new Date("2026-03-10T12:00:00Z");

beforeEach(() => useSchedulerEnvironment(T0));
afterEach(() => resetSchedulerEnvironment());

async function tool(userId: number, name: string, args: Record<string, unknown>, timezone = "UTC") {
  const call = { id: "call", name, arguments: args };
  return JSON.parse(await executeToolCall(call, userId, timezone)) as {
    ok: boolean;
    itemId?: number;
    error?: string;
  };
}

async function savedItem(itemId: number) {
  const [row] = await db.select().from(items).where(eq(items.id, itemId));
  return row;
}

const SUBSCRIPTION_SCHEMA = {
  fields: [
    { key: "price", label: "price", type: "currency" },
    { key: "plan", label: "plan", type: "select", options: ["basic", "premium"] },
  ],
};

describe("update_item custom fields", () => {
  it("rejects values the bucket's fields don't allow", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId, undefined, SUBSCRIPTION_SCHEMA);
    const itemId = await seedItem(userId, bucketId, { deadline: new Date(T0.getTime() + HOUR) });

    const result = await tool(userId, "update_item", {
      item_id: itemId,
      properties: { plan: "ultra" },
    });

    expect(result.ok).toBe(false);
    expect((await savedItem(itemId)).properties).toBeNull();
  });

  it("changes only the fields it's given", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId, undefined, SUBSCRIPTION_SCHEMA);
    const { itemId } = await tool(userId, "add_item", {
      bucket_id: bucketId,
      title: "netflix",
      properties: { price: 15, plan: "basic" },
    });

    expect(
      await tool(userId, "update_item", { item_id: itemId, properties: { price: 18 } })
    ).toMatchObject({ ok: true });

    expect(JSON.parse((await savedItem(itemId ?? -1)).properties ?? "null")).toEqual({
      price: 18,
      plan: "basic",
    });
  });
});

describe("item statuses", () => {
  it("add_item rejects a status that doesn't exist", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);

    const result = await tool(userId, "add_item", {
      bucket_id: bucketId,
      title: "old taxes",
      status: "archived",
    });

    expect(result.ok).toBe(false);
    expect(await db.select().from(items).where(eq(items.bucketId, bucketId))).toHaveLength(0);
  });

  it("update_item rejects a status that doesn't exist", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);
    const itemId = await seedItem(userId, bucketId, { deadline: new Date(T0.getTime() + HOUR) });

    const result = await tool(userId, "update_item", { item_id: itemId, status: "in progress" });

    expect(result.ok).toBe(false);
    expect((await savedItem(itemId)).status).toBe("active");
  });

  it("update_item accepts on hold", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);
    const itemId = await seedItem(userId, bucketId, { deadline: new Date(T0.getTime() + HOUR) });

    expect(await tool(userId, "update_item", { item_id: itemId, status: "on hold" })).toMatchObject(
      { ok: true }
    );
    expect((await savedItem(itemId)).status).toBe("on hold");
  });
});

describe("repeats", () => {
  async function addRepeating(userId: number, args: Record<string, unknown>, timezone = "UTC") {
    const bucketId = await seedBucket(userId);
    const result = await tool(
      userId,
      "add_item",
      { bucket_id: bucketId, title: "netflix", deadline: "2026-03-10T09:00:00", ...args },
      timezone
    );
    expect(result).toMatchObject({ ok: true });
    return savedItem(result.itemId ?? -1);
  }

  it("month end moves the deadline to the last day and repeats on each month's last day", async () => {
    const userId = await seedUser("Asia/Kolkata");
    const item = await addRepeating(
      userId,
      { recurring_frequency: "monthly", recurring_last_day_of_month: true },
      "Asia/Kolkata"
    );

    expect(item.deadline?.toISOString()).toBe("2026-03-31T03:30:00.000Z");
    expect(JSON.parse(item.recurring ?? "null")).toMatchObject({
      frequency: "monthly",
      anchorDay: 31,
    });

    await tool(userId, "complete_item", { item_id: item.id });
    const [next] = await db
      .select()
      .from(items)
      .where(and(eq(items.bucketId, item.bucketId), ne(items.id, item.id)));
    expect(next?.deadline?.toISOString()).toBe("2026-04-30T03:30:00.000Z");
  });

  it("weekly on picked days", async () => {
    const userId = await seedUser();
    const item = await addRepeating(userId, {
      recurring_frequency: "weekly",
      recurring_weekdays: ["fri", "mon", "wed"],
    });

    expect(JSON.parse(item.recurring ?? "null")).toMatchObject({ weekdays: [1, 3, 5] });
  });

  it.each([
    [
      "weekdays on a monthly repeat",
      { recurring_frequency: "monthly", recurring_weekdays: ["mon"] },
    ],
    [
      "last day on a weekly repeat",
      { recurring_frequency: "weekly", recurring_last_day_of_month: true },
    ],
    ["an unknown weekday", { recurring_frequency: "weekly", recurring_weekdays: ["someday"] }],
    ["a repeat without a frequency", { recurring_interval: 2 }],
  ])("refuses %s", async (_, args) => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);
    const result = await tool(userId, "add_item", {
      bucket_id: bucketId,
      title: "netflix",
      deadline: "2026-03-10T09:00:00",
      ...args,
    });

    expect(result.ok).toBe(false);
  });

  it("refuses a repeat without a deadline", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);
    const result = await tool(userId, "add_item", {
      bucket_id: bucketId,
      title: "netflix",
      recurring_frequency: "monthly",
    });

    expect(result.ok).toBe(false);
  });

  it("update_item keeps the parts of the repeat it isn't given", async () => {
    const userId = await seedUser();
    const item = await addRepeating(userId, {
      recurring_frequency: "monthly",
      recurring_last_day_of_month: true,
    });

    await tool(userId, "update_item", { item_id: item.id, recurring_interval: 2 });

    expect(JSON.parse((await savedItem(item.id)).recurring ?? "null")).toMatchObject({
      frequency: "monthly",
      interval: 2,
      anchorDay: 31,
    });
  });

  it("update_item switching to last day moves the deadline", async () => {
    const userId = await seedUser();
    const item = await addRepeating(userId, { recurring_frequency: "monthly" });

    await tool(userId, "update_item", { item_id: item.id, recurring_last_day_of_month: true });

    expect((await savedItem(item.id)).deadline?.toISOString()).toBe("2026-03-31T09:00:00.000Z");
  });

  it("update_item with a new frequency drops the old weekdays", async () => {
    const userId = await seedUser();
    const item = await addRepeating(userId, {
      recurring_frequency: "weekly",
      recurring_weekdays: ["mon", "wed"],
    });

    await tool(userId, "update_item", { item_id: item.id, recurring_frequency: "daily" });

    const recurring = JSON.parse((await savedItem(item.id)).recurring ?? "null") as {
      weekdays?: number[];
    };
    expect(recurring.weekdays).toBeUndefined();
  });
});

describe("dates capy reads", () => {
  // India is UTC+5:30: Oct 30 all day is Oct 29 18:30 UTC, Oct 29 9pm is Oct 29 15:30 UTC
  const INDIA = "Asia/Kolkata";

  async function seedIndianBucket() {
    const userId = await seedUser(INDIA);
    const bucketId = await seedBucket(userId);
    await seedItem(userId, bucketId, {
      title: "hotstar",
      deadline: new Date("2026-10-29T18:30:00Z"),
    });
    await seedItem(userId, bucketId, {
      title: "gym fees",
      deadline: new Date("2026-10-29T15:30:00Z"),
    });
    return { userId, bucketId };
  }

  function byTitle(rows: { title: string; deadline: unknown }[]) {
    return Object.fromEntries(rows.map((r) => [r.title, r.deadline]));
  }

  it("list_items gives deadlines in the user's own time", async () => {
    const { userId, bucketId } = await seedIndianBucket();
    const call = { id: "call", name: "list_items", arguments: { bucket_id: bucketId } };

    const rows = JSON.parse(await executeToolCall(call, userId, INDIA)) as {
      title: string;
      deadline: unknown;
    }[];

    expect(byTitle(rows)).toEqual({
      hotstar: "Fri 2026-10-30, all day",
      "gym fees": "Thu 2026-10-29 21:00",
    });
  });

  it("search_items gives deadlines in the user's own time", async () => {
    const { userId } = await seedIndianBucket();
    const call = { id: "call", name: "search_items", arguments: {} };

    const rows = JSON.parse(await executeToolCall(call, userId, INDIA)) as {
      title: string;
      deadline: unknown;
    }[];

    expect(byTitle(rows)).toEqual({
      hotstar: "Fri 2026-10-30, all day",
      "gym fees": "Thu 2026-10-29 21:00",
    });
  });
});

describe("overdue the way the app shows it", () => {
  // T0 is 17:30 in India
  const INDIA = "Asia/Kolkata";

  async function titlesFor(filter: string) {
    const userId = await seedUser(INDIA);
    const bucketId = await seedBucket(userId);
    await seedItem(userId, bucketId, {
      title: "yesterday",
      deadline: new Date("2026-03-09T06:30:00Z"),
    });
    await seedItem(userId, bucketId, { title: "noon", deadline: new Date("2026-03-10T06:30:00Z") });
    await seedItem(userId, bucketId, {
      title: "all day",
      deadline: new Date("2026-03-09T18:30:00Z"),
    });
    await seedItem(userId, bucketId, {
      title: "dinner",
      deadline: new Date("2026-03-10T15:00:00Z"),
    });
    const call = { id: "call", name: "search_items", arguments: { deadline_filter: filter } };
    const rows = JSON.parse(await executeToolCall(call, userId, INDIA)) as { title: string }[];
    return rows.map((r) => r.title).sort();
  }

  it("counts a time earlier today as overdue", async () => {
    expect(await titlesFor("overdue")).toEqual(["noon", "yesterday"]);
  });

  it("today still includes what's already overdue today", async () => {
    expect(await titlesFor("today")).toEqual(["all day", "dinner", "noon"]);
  });
});

describe("item details capy reads", () => {
  it("search_items gives the same details as list_items", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId, undefined, SUBSCRIPTION_SCHEMA);
    await tool(userId, "add_item", {
      bucket_id: bucketId,
      title: "netflix",
      deadline: "2026-03-31T09:00:00",
      properties: { price: 15, plan: "premium" },
      recurring_frequency: "monthly",
      recurring_last_day_of_month: true,
      reminder_offsets_mins: [1440],
    });

    const listed = JSON.parse(
      await executeToolCall(
        { id: "call", name: "list_items", arguments: { bucket_id: bucketId } },
        userId
      )
    ) as Record<string, unknown>[];
    const found = JSON.parse(
      await executeToolCall(
        { id: "call", name: "search_items", arguments: { keyword: "netflix" } },
        userId
      )
    ) as Record<string, unknown>[];

    expect(found[0]).toMatchObject({
      properties: { price: 15, plan: "premium" },
      recurring: { frequency: "monthly", anchorDay: 31 },
      reminderOffsets: [1440],
    });
    expect(found[0]).toMatchObject(listed[0] ?? {});
  });
});

describe("dates capy saves", () => {
  // The suite's clock: Tue 2026-03-10 12:00 UTC
  type Saved = { ok: boolean; error?: string; item?: { deadline: string | null } };

  async function addWith(userId: number, args: Record<string, unknown>) {
    const bucketId = await seedBucket(userId);
    const call = {
      id: "call",
      name: "add_item",
      arguments: { bucket_id: bucketId, title: "clean room", ...args },
    };
    return JSON.parse(await executeToolCall(call, userId)) as Saved;
  }

  it("refuses a day before today, saying what today is", async () => {
    const userId = await seedUser();

    const result = await addWith(userId, { deadline: "2025-05-19T22:30:00" });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Tue 2026-03-10");
  });

  it("takes a past day when told it's meant", async () => {
    const userId = await seedUser();

    const result = await addWith(userId, { deadline: "2026-03-01T09:00:00", allow_past: true });

    expect(result).toMatchObject({ ok: true, item: { deadline: "Sun 2026-03-01 09:00" } });
  });

  it("takes earlier today", async () => {
    const userId = await seedUser();

    expect((await addWith(userId, { deadline: "2026-03-10T08:00:00" })).ok).toBe(true);
  });

  it("add_item and update_item say what was saved", async () => {
    const userId = await seedUser();
    const added = await addWith(userId, { deadline: "2026-03-11T22:30:00" });
    expect(added.item?.deadline).toBe("Wed 2026-03-11 22:30");

    const itemId = (added as { itemId?: number }).itemId;
    const call = {
      id: "call",
      name: "update_item",
      arguments: { item_id: itemId, deadline: "2026-03-12T22:30:00" },
    };
    const updated = JSON.parse(await executeToolCall(call, userId)) as Saved;

    expect(updated).toMatchObject({ ok: true, item: { deadline: "Thu 2026-03-12 22:30" } });
  });

  it("update_item refuses a day before today too", async () => {
    const userId = await seedUser();
    const added = await addWith(userId, { deadline: "2026-03-11T22:30:00" });
    const call = {
      id: "call",
      name: "update_item",
      arguments: {
        item_id: (added as { itemId?: number }).itemId,
        deadline: "2025-05-19T22:30:00",
      },
    };

    expect((JSON.parse(await executeToolCall(call, userId)) as Saved).ok).toBe(false);
  });
});

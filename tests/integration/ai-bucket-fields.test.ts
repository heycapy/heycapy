import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bucketMembers, buckets } from "@/lib/db/schema";
import { executeToolCall } from "@/lib/ai/capyTools";
import { parseFields } from "@/components/buckets/fields";
import {
  resetSchedulerEnvironment,
  seedBucket,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

beforeEach(() => useSchedulerEnvironment(new Date("2026-03-10T12:00:00Z")));
afterEach(() => resetSchedulerEnvironment());

type Result = { ok: boolean; bucketId?: number; error?: string; removed?: string[] };

async function tool(userId: number, name: string, args: Record<string, unknown>) {
  return JSON.parse(await executeToolCall({ id: "call", name, arguments: args }, userId)) as Result;
}

async function storedSchema(bucketId: number) {
  const [row] = await db.select().from(buckets).where(eq(buckets.id, bucketId));
  return JSON.parse(String(row?.fieldSchema)) as Record<string, unknown>;
}

describe("capy creating a bucket with fields", () => {
  it("saves them like the editor would, and items must follow them", async () => {
    const userId = await seedUser();
    const created = await tool(userId, "create_bucket", {
      name: "Subscriptions",
      fields: [
        { label: "Monthly cost", type: "currency", currency: "₹", required: true },
        { label: "Plan", type: "select", options: ["basic", "pro"], show_in_row: false },
      ],
    });
    expect(created.ok).toBe(true);
    const bucketId = created.bucketId ?? 0;
    expect(parseFields(await storedSchema(bucketId))).toEqual([
      {
        key: "monthly_cost",
        label: "Monthly cost",
        type: "currency",
        currency: "₹",
        showInRow: true,
        validation: { required: true },
      },
      { key: "plan", label: "Plan", type: "select", options: ["basic", "pro"], showInRow: false },
    ]);

    const missing = await tool(userId, "add_item", { bucket_id: bucketId, title: "netflix" });
    expect(missing.ok).toBe(false);
    const added = await tool(userId, "add_item", {
      bucket_id: bucketId,
      title: "netflix",
      properties: { monthly_cost: 649, plan: "pro" },
    });
    expect(added.ok).toBe(true);
  });

  it("makes no bucket when a field is wrong", async () => {
    const userId = await seedUser();
    const result = await tool(userId, "create_bucket", {
      name: "Reading",
      fields: [{ label: "Status", type: "select" }],
    });
    expect(result).toEqual({ ok: false, error: '"Status" is a choice field and needs options' });
    const made = await db
      .select()
      .from(buckets)
      .where(and(eq(buckets.userId, userId), eq(buckets.name, "Reading")));
    expect(made).toHaveLength(0);
  });
});

describe("capy changing a bucket's fields", () => {
  const SCHEMA = {
    fields: [
      { key: "monthly_cost", label: "Cost", type: "currency", validation: { required: true } },
      { key: "plan", label: "Plan", type: "select", options: ["basic", "pro"] },
    ],
    notifyWhenOverdue: true,
  };

  it("changes only what it's given, keeps the overdue settings and names what it removed", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId, undefined, SCHEMA);
    const result = await tool(userId, "update_bucket_fields", {
      bucket_id: bucketId,
      fields: [
        { key: "monthly_cost", label: "Monthly cost", type: "currency" },
        { label: "Renews on", type: "date" },
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.removed).toEqual(["Plan"]);

    const schema = await storedSchema(bucketId);
    expect(schema.notifyWhenOverdue).toBe(true);
    expect(parseFields(schema)).toEqual([
      {
        key: "monthly_cost",
        label: "Monthly cost",
        type: "currency",
        showInRow: true,
        validation: { required: true },
      },
      { key: "renews_on", label: "Renews on", type: "date", showInRow: true },
    ]);
  });

  it("is refused for a member who isn't the owner", async () => {
    const owner = await seedUser();
    const member = await seedUser();
    const bucketId = await seedBucket(owner, undefined, SCHEMA);
    await db.insert(bucketMembers).values({ bucketId, userId: member });

    const result = await tool(member, "update_bucket_fields", {
      bucket_id: bucketId,
      fields: [],
    });
    expect(result.ok).toBe(false);
    expect(parseFields(await storedSchema(bucketId))).toHaveLength(2);
  });
});

import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, items } from "@/lib/db/schema";
import type { Tool, ToolCall } from "./types";

export const CAPY_TOOLS: Tool[] = [
  {
    name: "list_buckets",
    description:
      "List all active buckets with their IDs and names. Call this if you need to confirm bucket IDs.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "add_item",
    description: "Add a new item to a bucket.",
    parameters: {
      type: "object",
      properties: {
        bucket_id: { type: "number", description: "The ID of the bucket." },
        title: { type: "string", description: "The item title." },
        deadline: { type: "string", description: "Optional deadline in ISO 8601 format." },
        notification_offset_mins: {
          type: "number",
          description: "Minutes before the deadline to send a notification.",
        },
      },
      required: ["bucket_id", "title"],
    },
  },
  {
    name: "complete_item",
    description: "Toggle an item's completion status (active ↔ completed).",
    parameters: {
      type: "object",
      properties: {
        item_id: { type: "number", description: "The ID of the item." },
      },
      required: ["item_id"],
    },
  },
  {
    name: "update_item",
    description: "Update an existing item's title, deadline, or notification offset.",
    parameters: {
      type: "object",
      properties: {
        item_id: { type: "number", description: "The ID of the item." },
        title: { type: "string", description: "New title." },
        deadline: {
          type: ["string", "null"],
          description: "New deadline in ISO 8601 format, or null to clear it.",
        },
        notification_offset_mins: {
          type: ["number", "null"],
          description: "Minutes before deadline to notify, or null to clear.",
        },
      },
      required: ["item_id"],
    },
  },
  {
    name: "delete_item",
    description: "Soft-delete an item.",
    parameters: {
      type: "object",
      properties: {
        item_id: { type: "number", description: "The ID of the item." },
      },
      required: ["item_id"],
    },
  },
  {
    name: "list_items",
    description: "List items in a bucket.",
    parameters: {
      type: "object",
      properties: {
        bucket_id: { type: "number", description: "The ID of the bucket." },
        include_completed: {
          type: "boolean",
          description: "Whether to include completed items. Defaults to false.",
        },
      },
      required: ["bucket_id"],
    },
  },
];

export async function executeToolCall(call: ToolCall, userId: number): Promise<string> {
  const args = call.arguments;

  switch (call.name) {
    case "list_buckets": {
      const result = await db
        .select({ id: buckets.id, name: buckets.name, icon: buckets.icon })
        .from(buckets)
        .where(
          and(eq(buckets.userId, userId), isNull(buckets.deletedAt), isNull(buckets.archivedAt))
        );
      return JSON.stringify(result);
    }

    case "add_item": {
      const bucketId = Number(args.bucket_id);
      const title = String(args.title ?? "").trim();
      if (!title) return JSON.stringify({ ok: false, error: "Title is required" });

      const bucket = await db.query.buckets.findFirst({
        where: (b, { eq: qeq, and: qand }) => qand(qeq(b.id, bucketId), qeq(b.userId, userId)),
      });
      if (!bucket) return JSON.stringify({ ok: false, error: "Bucket not found" });

      const [maxRow] = await db
        .select({ max: sql<number>`COALESCE(MAX(${items.sortOrder}), -1)` })
        .from(items)
        .where(eq(items.bucketId, bucketId));

      const deadline = args.deadline ? new Date(String(args.deadline)) : null;
      const notificationOffsetMins =
        args.notification_offset_mins !== null && args.notification_offset_mins !== undefined
          ? Number(args.notification_offset_mins)
          : null;

      const [inserted] = await db
        .insert(items)
        .values({
          bucketId,
          userId,
          title,
          deadline,
          notificationOffsetMins,
          source: "ai",
          sortOrder: (maxRow?.max ?? -1) + 1,
        })
        .returning({ id: items.id });

      revalidatePath("/");
      return JSON.stringify({ ok: true, itemId: inserted?.id });
    }

    case "complete_item": {
      const itemId = Number(args.item_id);
      const item = await db.query.items.findFirst({
        where: (i, { eq: qeq, and: qand }) => qand(qeq(i.id, itemId), qeq(i.userId, userId)),
      });
      if (!item) return JSON.stringify({ ok: false, error: "Item not found" });

      const newStatus = item.status === "completed" ? "active" : "completed";
      await db
        .update(items)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(and(eq(items.id, itemId), eq(items.userId, userId)));

      revalidatePath("/");
      return JSON.stringify({ ok: true, newStatus });
    }

    case "update_item": {
      const itemId = Number(args.item_id);
      const item = await db.query.items.findFirst({
        where: (i, { eq: qeq, and: qand }) => qand(qeq(i.id, itemId), qeq(i.userId, userId)),
      });
      if (!item) return JSON.stringify({ ok: false, error: "Item not found" });

      const updates: {
        updatedAt: Date;
        title?: string;
        deadline?: Date | null;
        notificationOffsetMins?: number | null;
      } = { updatedAt: new Date() };

      if (args.title !== undefined) {
        const title = String(args.title).trim();
        if (!title) return JSON.stringify({ ok: false, error: "Title cannot be empty" });
        updates.title = title;
      }
      if ("deadline" in args) {
        updates.deadline = args.deadline ? new Date(String(args.deadline)) : null;
      }
      if ("notification_offset_mins" in args) {
        updates.notificationOffsetMins =
          args.notification_offset_mins !== null && args.notification_offset_mins !== undefined
            ? Number(args.notification_offset_mins)
            : null;
      }

      await db
        .update(items)
        .set(updates)
        .where(and(eq(items.id, itemId), eq(items.userId, userId)));

      revalidatePath("/");
      return JSON.stringify({ ok: true });
    }

    case "delete_item": {
      const itemId = Number(args.item_id);
      const item = await db.query.items.findFirst({
        where: (i, { eq: qeq, and: qand }) => qand(qeq(i.id, itemId), qeq(i.userId, userId)),
      });
      if (!item) return JSON.stringify({ ok: false, error: "Item not found" });

      await db
        .update(items)
        .set({ deletedAt: new Date() })
        .where(and(eq(items.id, itemId), eq(items.userId, userId)));

      revalidatePath("/");
      return JSON.stringify({ ok: true });
    }

    case "list_items": {
      const bucketId = Number(args.bucket_id);
      const includeCompleted = Boolean(args.include_completed ?? false);

      const bucket = await db.query.buckets.findFirst({
        where: (b, { eq: qeq, and: qand }) => qand(qeq(b.id, bucketId), qeq(b.userId, userId)),
      });
      if (!bucket) return JSON.stringify({ ok: false, error: "Bucket not found" });

      const result = await db
        .select({
          id: items.id,
          title: items.title,
          deadline: items.deadline,
          status: items.status,
          notificationOffsetMins: items.notificationOffsetMins,
        })
        .from(items)
        .where(
          includeCompleted
            ? and(eq(items.bucketId, bucketId), eq(items.userId, userId), isNull(items.deletedAt))
            : and(
                eq(items.bucketId, bucketId),
                eq(items.userId, userId),
                isNull(items.deletedAt),
                eq(items.status, "active")
              )
        );

      return JSON.stringify(result);
    }

    default:
      return JSON.stringify({ ok: false, error: `Unknown tool: ${call.name}` });
  }
}

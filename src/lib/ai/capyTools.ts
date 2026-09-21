import { revalidatePath } from "next/cache";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, items } from "@/lib/db/schema";
import { RecurringConfig } from "@/types/rules";
import type { Tool, ToolCall } from "./types";

function toDateStr(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const mo = parts.find((p) => p.type === "month")?.value ?? "";
  const dy = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}-${mo}-${dy}`;
}

function deadlineRelative(deadline: Date, timezone: string): string {
  const now = new Date();
  const todayStr = toDateStr(now, timezone);
  const deadlineStr = toDateStr(deadline, timezone);

  if (deadlineStr < todayStr) return "overdue";
  if (deadlineStr === todayStr) return "today";

  const tomorrowStr = toDateStr(new Date(now.getTime() + 86_400_000), timezone);
  if (deadlineStr === tomorrowStr) return "tomorrow";

  const diffDays = Math.round((deadline.getTime() - now.getTime()) / 86_400_000);
  if (diffDays <= 7) return `in ${diffDays} days`;
  if (diffDays <= 30) return `in ${Math.round(diffDays / 7)} weeks`;
  return `in ${Math.round(diffDays / 30)} months`;
}

function parseRecurringArgs(args: Record<string, unknown>): string | null | undefined {
  if (args.clear_recurring === true) return null;
  if (args.recurring_frequency === undefined) return undefined;

  const config = RecurringConfig.parse({
    enabled: true,
    frequency: args.recurring_frequency,
    interval: args.recurring_interval ?? 1,
    endDate: args.recurring_end_date ?? null,
  });
  return JSON.stringify(config);
}

export const CAPY_TOOLS: Tool[] = [
  {
    name: "list_buckets",
    description:
      "List all of the user's active buckets with their IDs, names, and icons. " +
      "Call this when you need to confirm bucket IDs or show the user what buckets they have. " +
      "The system prompt already contains the bucket list, so only call this if you think it may have changed " +
      "(e.g. you just created or deleted a bucket).",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "create_bucket",
    description:
      "Create a new bucket (list) for the user. " +
      "Use this when the user asks to create, add, or set up a new bucket, list, or category. " +
      "Returns the new bucket's ID — use it immediately if you need to add items to it.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description:
            "The name of the new bucket. Keep it short and descriptive, e.g. 'Groceries', 'Work Tasks', 'Subscriptions'.",
        },
        icon: {
          type: "string",
          description: "Optional single emoji to use as the bucket icon, e.g. '🛒', '💼', '📦'.",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "update_bucket",
    description:
      "Rename a bucket or change its icon. " +
      "Use this when the user asks to rename, edit, or update a bucket. " +
      "Only include the fields you want to change.",
    parameters: {
      type: "object",
      properties: {
        bucket_id: {
          type: "number",
          description: "The ID of the bucket to update.",
        },
        name: {
          type: "string",
          description: "New name for the bucket.",
        },
        icon: {
          type: ["string", "null"],
          description: "New emoji icon, or null to remove the icon.",
        },
      },
      required: ["bucket_id"],
    },
  },
  {
    name: "delete_bucket",
    description:
      "Permanently delete a bucket and all its items. " +
      "Only do this when the user explicitly asks to delete or remove a bucket. " +
      "This action cannot be undone — always confirm with the user before calling this.",
    parameters: {
      type: "object",
      properties: {
        bucket_id: {
          type: "number",
          description: "The ID of the bucket to delete.",
        },
      },
      required: ["bucket_id"],
    },
  },
  {
    name: "add_item",
    description:
      "Add a new item (task, reminder, or entry) to a bucket. " +
      "Use this when the user asks to add, create, or track something. " +
      "If the user mentions a deadline without a time, ask what time before calling this. " +
      "If recurring fields are included, the item will automatically reschedule after each notification.",
    parameters: {
      type: "object",
      properties: {
        bucket_id: {
          type: "number",
          description: "The ID of the bucket to add the item to.",
        },
        title: {
          type: "string",
          description: "The item title. Keep it concise and clear.",
        },
        deadline: {
          type: "string",
          description:
            "Optional deadline as an ISO 8601 datetime string, e.g. '2026-09-21T09:00:00Z'. " +
            "Always include time — if the user only gave a date, ask for the time first.",
        },
        notification_offset_mins: {
          type: "number",
          description:
            "How many minutes before the deadline to send a notification. " +
            "Common values: 0 (at deadline), 30, 60, 1440 (1 day before), 10080 (1 week before). " +
            "Leave unset to use the bucket's default.",
        },
        recurring_frequency: {
          type: "string",
          enum: ["daily", "weekly", "monthly", "yearly"],
          description:
            "How often the item repeats. When set, the deadline automatically advances " +
            "to the next occurrence after each notification fires. Requires a deadline.",
        },
        recurring_interval: {
          type: "number",
          description:
            "How many units between recurrences. Defaults to 1. " +
            "E.g. frequency='weekly' + interval=2 means every 2 weeks.",
        },
        recurring_end_date: {
          type: "string",
          description:
            "Optional end date for the recurring series in ISO 8601 date format, e.g. '2027-01-01'. " +
            "After this date, the item stops rescheduling.",
        },
      },
      required: ["bucket_id", "title"],
    },
  },
  {
    name: "update_item",
    description:
      "Update an existing item's title, deadline, notification offset, or recurring configuration. " +
      "Only include fields you want to change — omitted fields are left as-is. " +
      "To clear the deadline, pass null. To remove recurring, set clear_recurring to true.",
    parameters: {
      type: "object",
      properties: {
        item_id: {
          type: "number",
          description: "The ID of the item to update.",
        },
        title: {
          type: "string",
          description: "New title for the item.",
        },
        deadline: {
          type: ["string", "null"],
          description:
            "New deadline as ISO 8601 datetime, or null to remove the deadline entirely.",
        },
        notification_offset_mins: {
          type: ["number", "null"],
          description: "New notification offset in minutes, or null to clear it.",
        },
        recurring_frequency: {
          type: "string",
          enum: ["daily", "weekly", "monthly", "yearly"],
          description: "New recurring frequency. Also set recurring_interval if needed.",
        },
        recurring_interval: {
          type: "number",
          description: "New recurring interval. Defaults to 1 if not provided.",
        },
        recurring_end_date: {
          type: ["string", "null"],
          description: "New recurring end date (ISO date), or null to remove it.",
        },
        clear_recurring: {
          type: "boolean",
          description:
            "Set to true to completely remove the recurring configuration from this item.",
        },
      },
      required: ["item_id"],
    },
  },
  {
    name: "complete_item",
    description:
      "Toggle an item's completion status between active and completed. " +
      "Use this when the user says they finished, completed, or did something. " +
      "If the item is currently active it becomes completed, and vice versa.",
    parameters: {
      type: "object",
      properties: {
        item_id: {
          type: "number",
          description: "The ID of the item to toggle.",
        },
      },
      required: ["item_id"],
    },
  },
  {
    name: "delete_item",
    description:
      "Permanently delete an item. " +
      "Use this when the user asks to remove, delete, or get rid of an item. " +
      "This cannot be undone.",
    parameters: {
      type: "object",
      properties: {
        item_id: {
          type: "number",
          description: "The ID of the item to delete.",
        },
      },
      required: ["item_id"],
    },
  },
  {
    name: "move_item",
    description:
      "Move an item from one bucket to another. " +
      "Use this when the user says to move, transfer, or put an item in a different bucket.",
    parameters: {
      type: "object",
      properties: {
        item_id: {
          type: "number",
          description: "The ID of the item to move.",
        },
        bucket_id: {
          type: "number",
          description: "The ID of the destination bucket.",
        },
      },
      required: ["item_id", "bucket_id"],
    },
  },
  {
    name: "snooze_item",
    description:
      "Snooze an item's notification until a specific date and time. " +
      "The item will not trigger a notification until after the snooze period ends. " +
      "Use this when the user says 'remind me later', 'snooze this', or 'remind me on [date]'. " +
      "Pass null to clear an existing snooze.",
    parameters: {
      type: "object",
      properties: {
        item_id: {
          type: "number",
          description: "The ID of the item to snooze.",
        },
        snooze_until: {
          type: ["string", "null"],
          description:
            "ISO 8601 datetime to snooze until, e.g. '2026-09-22T09:00:00Z'. " +
            "Pass null to clear the snooze.",
        },
      },
      required: ["item_id", "snooze_until"],
    },
  },
  {
    name: "list_items",
    description:
      "List items in a specific bucket. " +
      "Use this when the user asks about the contents of a particular bucket, asks how many items are in it, " +
      "or when you need item IDs to perform follow-up operations. " +
      "By default only returns active (non-completed) items. " +
      "Always set include_completed to true when the user wants a count of ALL items or asks 'what's in X'. " +
      "For searching across all buckets, use search_items instead.",
    parameters: {
      type: "object",
      properties: {
        bucket_id: {
          type: "number",
          description: "The ID of the bucket to list items from.",
        },
        include_completed: {
          type: "boolean",
          description:
            "Whether to include completed items. Defaults to false (active only). " +
            "Set to true when the user wants all items or a total count.",
        },
      },
      required: ["bucket_id"],
    },
  },
  {
    name: "search_items",
    description:
      "Search for items across all buckets (or within one bucket) using a keyword and/or deadline filter. " +
      "Use this to answer questions like 'what's due today?', 'what's overdue?', " +
      "'show me everything due this week', or 'find my Netflix reminder'. " +
      "Prefer this over calling list_items multiple times when you don't know which bucket contains the item.",
    parameters: {
      type: "object",
      properties: {
        keyword: {
          type: "string",
          description:
            "Optional text to search for in item titles (case-insensitive, partial match). " +
            "E.g. 'netflix', 'doctor', 'rent'.",
        },
        deadline_filter: {
          type: "string",
          enum: ["overdue", "today", "tomorrow", "this_week", "all"],
          description:
            "Filter items by their deadline relative to today. " +
            "'overdue' = past deadline, 'today' = due today, 'tomorrow' = due tomorrow, " +
            "'this_week' = due within the next 7 days (includes today), 'all' = no deadline filter. " +
            "Defaults to 'all'.",
        },
        bucket_id: {
          type: "number",
          description:
            "Optional bucket ID to restrict the search to a single bucket. " +
            "Omit to search across all buckets.",
        },
        include_completed: {
          type: "boolean",
          description: "Whether to include completed items. Defaults to false.",
        },
      },
    },
  },
];

export async function executeToolCall(
  call: ToolCall,
  userId: number,
  timezone = "UTC"
): Promise<string> {
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

    case "create_bucket": {
      const name = String(args.name ?? "").trim();
      if (!name) return JSON.stringify({ ok: false, error: "Name is required" });

      const [maxRow] = await db
        .select({ max: sql<number>`COALESCE(MAX(${buckets.sortOrder}), -1)` })
        .from(buckets)
        .where(eq(buckets.userId, userId));

      const [inserted] = await db
        .insert(buckets)
        .values({
          userId,
          name,
          icon: args.icon ? String(args.icon) : null,
          sortOrder: (maxRow?.max ?? -1) + 1,
        })
        .returning({ id: buckets.id });

      revalidatePath("/");
      return JSON.stringify({ ok: true, bucketId: inserted?.id });
    }

    case "update_bucket": {
      const bucketId = Number(args.bucket_id);
      const bucket = await db.query.buckets.findFirst({
        where: (b, { eq: qeq, and: qand }) => qand(qeq(b.id, bucketId), qeq(b.userId, userId)),
      });
      if (!bucket) return JSON.stringify({ ok: false, error: "Bucket not found" });

      const updates: { updatedAt: Date; name?: string; icon?: string | null } = {
        updatedAt: new Date(),
      };
      if (args.name !== undefined) {
        const name = String(args.name).trim();
        if (!name) return JSON.stringify({ ok: false, error: "Name cannot be empty" });
        updates.name = name;
      }
      if ("icon" in args) {
        updates.icon = args.icon ? String(args.icon) : null;
      }

      await db
        .update(buckets)
        .set(updates)
        .where(and(eq(buckets.id, bucketId), eq(buckets.userId, userId)));

      revalidatePath("/");
      return JSON.stringify({ ok: true });
    }

    case "delete_bucket": {
      const bucketId = Number(args.bucket_id);
      const bucket = await db.query.buckets.findFirst({
        where: (b, { eq: qeq, and: qand }) => qand(qeq(b.id, bucketId), qeq(b.userId, userId)),
      });
      if (!bucket) return JSON.stringify({ ok: false, error: "Bucket not found" });

      await db
        .update(buckets)
        .set({ deletedAt: new Date() })
        .where(and(eq(buckets.id, bucketId), eq(buckets.userId, userId)));

      revalidatePath("/");
      return JSON.stringify({ ok: true });
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

      let recurringJson: string | null = null;
      try {
        const parsed = parseRecurringArgs(args);
        if (parsed !== undefined) recurringJson = parsed;
      } catch {
        return JSON.stringify({ ok: false, error: "Invalid recurring configuration" });
      }

      const [inserted] = await db
        .insert(items)
        .values({
          bucketId,
          userId,
          title,
          status: "active",
          deadline,
          notificationOffsetMins,
          recurring: recurringJson,
          source: "ai",
          sortOrder: (maxRow?.max ?? -1) + 1,
        })
        .returning({ id: items.id });

      revalidatePath("/");
      return JSON.stringify({ ok: true, itemId: inserted?.id });
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
        recurring?: string | null;
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

      try {
        const parsed = parseRecurringArgs(args);
        if (parsed !== undefined) updates.recurring = parsed;
      } catch {
        return JSON.stringify({ ok: false, error: "Invalid recurring configuration" });
      }

      await db
        .update(items)
        .set(updates)
        .where(and(eq(items.id, itemId), eq(items.userId, userId)));

      revalidatePath("/");
      return JSON.stringify({ ok: true });
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

    case "move_item": {
      const itemId = Number(args.item_id);
      const destBucketId = Number(args.bucket_id);

      const [item, destBucket] = await Promise.all([
        db.query.items.findFirst({
          where: (i, { eq: qeq, and: qand }) => qand(qeq(i.id, itemId), qeq(i.userId, userId)),
        }),
        db.query.buckets.findFirst({
          where: (b, { eq: qeq, and: qand }) =>
            qand(qeq(b.id, destBucketId), qeq(b.userId, userId)),
        }),
      ]);
      if (!item) return JSON.stringify({ ok: false, error: "Item not found" });
      if (!destBucket) return JSON.stringify({ ok: false, error: "Destination bucket not found" });

      const [maxRow] = await db
        .select({ max: sql<number>`COALESCE(MAX(${items.sortOrder}), -1)` })
        .from(items)
        .where(eq(items.bucketId, destBucketId));

      await db
        .update(items)
        .set({ bucketId: destBucketId, sortOrder: (maxRow?.max ?? -1) + 1, updatedAt: new Date() })
        .where(and(eq(items.id, itemId), eq(items.userId, userId)));

      revalidatePath("/");
      return JSON.stringify({ ok: true });
    }

    case "snooze_item": {
      const itemId = Number(args.item_id);
      const item = await db.query.items.findFirst({
        where: (i, { eq: qeq, and: qand }) => qand(qeq(i.id, itemId), qeq(i.userId, userId)),
      });
      if (!item) return JSON.stringify({ ok: false, error: "Item not found" });

      const snoozedUntil = args.snooze_until ? new Date(String(args.snooze_until)) : null;
      await db
        .update(items)
        .set({ snoozedUntil, updatedAt: new Date() })
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

      const rows = await db
        .select({
          id: items.id,
          title: items.title,
          deadline: items.deadline,
          status: items.status,
          notificationOffsetMins: items.notificationOffsetMins,
          snoozedUntil: items.snoozedUntil,
          recurring: items.recurring,
        })
        .from(items)
        .where(
          includeCompleted
            ? and(eq(items.bucketId, bucketId), eq(items.userId, userId), isNull(items.deletedAt))
            : and(
                eq(items.bucketId, bucketId),
                eq(items.userId, userId),
                isNull(items.deletedAt),
                or(eq(items.status, "active"), isNull(items.status))
              )
        );

      const enriched = rows.map((row) => ({
        ...row,
        recurring: row.recurring ? (JSON.parse(row.recurring) as unknown) : null,
        deadlineRelative: row.deadline ? deadlineRelative(row.deadline, timezone) : null,
      }));
      return JSON.stringify(enriched);
    }

    case "search_items": {
      const keyword = args.keyword ? String(args.keyword).trim() : null;
      const deadlineFilter = (args.deadline_filter as string | undefined) ?? "all";
      const bucketId = args.bucket_id !== undefined ? Number(args.bucket_id) : null;
      const includeCompleted = Boolean(args.include_completed ?? false);

      const activeFilter = or(eq(items.status, "active"), isNull(items.status));
      const conditions = [
        eq(items.userId, userId),
        isNull(items.deletedAt),
        ...(includeCompleted ? [] : [activeFilter]),
      ];
      if (bucketId !== null) conditions.push(eq(items.bucketId, bucketId));

      const rows = await db
        .select({
          id: items.id,
          title: items.title,
          deadline: items.deadline,
          status: items.status,
          bucketId: items.bucketId,
          notificationOffsetMins: items.notificationOffsetMins,
          snoozedUntil: items.snoozedUntil,
        })
        .from(items)
        .where(and(...conditions));

      // Filter by keyword in JS: split into words, each word must appear somewhere in title
      const keywordWords = keyword ? keyword.toLowerCase().split(/\s+/).filter(Boolean) : null;

      const bucketRows = await db
        .select({ id: buckets.id, name: buckets.name })
        .from(buckets)
        .where(and(eq(buckets.userId, userId), isNull(buckets.deletedAt)));
      const bucketMap = new Map(bucketRows.map((b) => [b.id, b.name]));

      const enriched = rows
        .filter((row) => {
          if (!keywordWords) return true;
          const lower = row.title.toLowerCase();
          return keywordWords.every((w) => lower.includes(w));
        })
        .map((row) => ({
          id: row.id,
          title: row.title,
          status: row.status,
          bucket: bucketMap.get(row.bucketId) ?? "Unknown",
          bucketId: row.bucketId,
          deadline: row.deadline,
          deadlineRelative: row.deadline ? deadlineRelative(row.deadline, timezone) : null,
          snoozedUntil: row.snoozedUntil,
        }))
        .filter((row) => {
          if (deadlineFilter === "all") return true;
          if (!row.deadlineRelative) return false;
          if (deadlineFilter === "overdue") return row.deadlineRelative === "overdue";
          if (deadlineFilter === "today") return row.deadlineRelative === "today";
          if (deadlineFilter === "tomorrow") return row.deadlineRelative === "tomorrow";
          if (deadlineFilter === "this_week") {
            return (
              row.deadlineRelative === "today" ||
              row.deadlineRelative === "tomorrow" ||
              row.deadlineRelative.startsWith("in ")
            );
          }
          return true;
        });

      return JSON.stringify(enriched);
    }

    default:
      return JSON.stringify({ ok: false, error: `Unknown tool: ${call.name}` });
  }
}

export type UpcomingItem = {
  id: number;
  title: string;
  bucket: string;
  deadlineRelative: string;
  deadline: Date;
};

export async function getUpcomingItems(userId: number, timezone: string): Promise<UpcomingItem[]> {
  const rows = await db
    .select({
      id: items.id,
      title: items.title,
      deadline: items.deadline,
      bucketId: items.bucketId,
    })
    .from(items)
    .where(
      and(
        eq(items.userId, userId),
        isNull(items.deletedAt),
        or(eq(items.status, "active"), isNull(items.status))
      )
    );

  const bucketRows = await db
    .select({ id: buckets.id, name: buckets.name })
    .from(buckets)
    .where(and(eq(buckets.userId, userId), isNull(buckets.deletedAt)));
  const bucketMap = new Map(bucketRows.map((b) => [b.id, b.name]));

  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 86_400_000);

  return rows
    .filter((row): row is typeof row & { deadline: Date } => {
      if (!row.deadline) return false;
      return row.deadline <= weekFromNow;
    })
    .map((row) => ({
      id: row.id,
      title: row.title,
      bucket: bucketMap.get(row.bucketId) ?? "Unknown",
      deadlineRelative: deadlineRelative(row.deadline, timezone),
      deadline: row.deadline,
    }))
    .sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
}

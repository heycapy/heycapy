import type { Tool } from "./types";

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

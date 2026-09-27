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
      "Only include the fields you want to change. " +
      "IMPORTANT: never put an emoji inside the name field — use the icon field for that. " +
      "The icon is displayed separately next to the bucket name in the UI.",
    parameters: {
      type: "object",
      properties: {
        bucket_id: {
          type: "number",
          description: "The ID of the bucket to update.",
        },
        name: {
          type: "string",
          description:
            "New plain-text name for the bucket. Do NOT include emoji here — use the icon field instead.",
        },
        icon: {
          type: ["string", "null"],
          description:
            "A single emoji to display next to the bucket name, e.g. '🛒', '💼', '📦'. Pass null to remove the icon.",
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
        status: {
          type: "string",
          description:
            "Initial status for the item. Defaults to 'active'. " +
            "System statuses are 'active', 'completed', 'on hold'. " +
            "Custom statuses are defined per-bucket in the bucket's schema.",
        },
        properties: {
          type: "object",
          description:
            "Optional key-value map of custom field values for this item, as defined by the bucket's schema. " +
            "Keys must match the field keys in the bucket's fieldSchema. " +
            "Only provide this if the user mentions specific field values or you know the bucket has custom fields.",
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
      "To clear the deadline, pass null. To remove recurring, set clear_recurring to true. " +
      "When the user says 'remind me later', 'remind me tomorrow' or 'postpone', move the deadline.",
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
        status: {
          type: "string",
          description:
            "Set the item's status by name (e.g. 'active', 'completed', 'on hold', or any custom status defined in the bucket schema).",
        },
        properties: {
          type: ["object", "null"],
          description:
            "Update custom field values. Pass an object with field key-value pairs to update, or null to clear all properties.",
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
      "'show me everything due this week', 'find my Netflix reminder', " +
      "'what did I complete in the last 2 days?', or 'what's coming up in the next 3 days?'. " +
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
        completed_within_days: {
          type: "number",
          description:
            "Return only items completed within the last N days (based on completedAt). " +
            "Automatically includes completed items — no need to also set include_completed. " +
            "E.g. 2 = completed in the last 2 days, 7 = last week.",
        },
        due_within_days: {
          type: "number",
          description:
            "Return only items whose deadline falls within the next N days from now. " +
            "E.g. 3 = due in the next 3 days, 7 = due in the next week. " +
            "Use this instead of deadline_filter when the user asks about a specific number of days ahead.",
        },
      },
    },
  },
];

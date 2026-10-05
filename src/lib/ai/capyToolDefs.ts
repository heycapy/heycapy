import type { Tool } from "./types";
import { SETTABLE_ITEM_STATUSES, WEEKDAY_NAMES } from "@/constants";
import { MAX_REMINDER_OFFSET_MINS, MAX_REMINDERS_PER_ITEM } from "@/lib/reminders/constants";

const ITEM_RESULT =
  "Each item comes with everything the item form shows: its custom field values (properties, " +
  "keyed by the bucket's field keys), repeat (recurring), reminders (reminderOffsets, minutes before " +
  "the deadline; null = the bucket's default reminders) and status. ";

const REPEAT_PROPERTIES = {
  recurring_frequency: {
    type: "string",
    enum: ["daily", "weekly", "monthly", "yearly"],
    description: "How often the item repeats. Requires a deadline.",
  },
  recurring_interval: {
    type: "integer",
    minimum: 1,
    description: "Units between repeats, default 1: weekly + 2 = every 2 weeks.",
  },
  recurring_weekdays: {
    type: ["array", "null"],
    items: { type: "string", enum: [...WEEKDAY_NAMES] },
    description:
      "Weekly repeats only: the days it falls on, e.g. ['mon', 'wed', 'fri'], or " +
      "['mon', 'tue', 'wed', 'thu', 'fri'] for weekdays. Leave out to repeat on the deadline's weekday.",
  },
  recurring_last_day_of_month: {
    type: "boolean",
    description:
      "Monthly repeats only: true = on the last day of every month (28th–31st), for 'month end' / " +
      "'end of the month'. The deadline is moved to that month's last day. False = on the deadline's day.",
  },
  recurring_end_date: {
    type: ["string", "null"],
    description:
      "Optional last date of the series as an ISO date, e.g. '2027-01-01', or null for no end.",
  },
};

export const ITEM_AND_BUCKET_TOOLS: Tool[] = [
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
      "Move a bucket and all its items to the trash. " +
      "Only do this when the user explicitly asks to delete or remove a bucket. Call it right away: the first call deletes nothing and tells you to ask the user, and the delete happens when you call it again after they say yes. " +
      "The user can restore it from the trash for 30 days; after that it is deleted for good.",
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
      "A repeating item needs a deadline: its first date. " +
      "The next date appears when the user completes it (how exactly is the bucket's repeating items setting).",
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
            "Optional deadline as a local datetime without a timezone, e.g. '2026-09-21T09:00:00'. " +
            "For a repeating item, the first date it's due.",
        },
        reminder_offsets_mins: {
          type: "array",
          items: { type: "integer", minimum: 0, maximum: MAX_REMINDER_OFFSET_MINS },
          maxItems: MAX_REMINDERS_PER_ITEM,
          description:
            "When to remind, as minutes before the deadline; one entry per reminder. " +
            "Common values: 0 (at deadline), 30, 60, 1440 (1 day before), 10080 (1 week before). " +
            "Leave unset to use the bucket's default.",
        },
        ...REPEAT_PROPERTIES,
        allow_past: {
          type: "boolean",
          description:
            "Only when the user explicitly wants a date before today (e.g. logging something already done). " +
            "Without it, a past day is refused.",
        },
        status: {
          type: "string",
          enum: [...SETTABLE_ITEM_STATUSES],
          description:
            "Initial status for the item. Defaults to 'active'. " +
            "'on hold' pauses the item's reminders until its status changes; it's what the user means by snooze, pause or put on hold.",
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
      "Update an existing item's title, deadline, reminders, or repeat. " +
      "Only include fields you want to change — omitted fields are left as-is, including each repeat field " +
      "(e.g. only recurring_interval: 2 makes a monthly item every 2 months). " +
      "Changing recurring_frequency drops the old weekdays / last-day choice. " +
      "To clear the deadline, pass null. To stop repeating, set clear_recurring to true. " +
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
        reminder_offsets_mins: {
          type: ["array", "null"],
          items: { type: "integer", minimum: 0, maximum: MAX_REMINDER_OFFSET_MINS },
          maxItems: MAX_REMINDERS_PER_ITEM,
          description:
            "The item's full new list of reminders, as minutes before the deadline " +
            "([] for none), or null to go back to the bucket's default.",
        },
        ...REPEAT_PROPERTIES,
        clear_recurring: {
          type: "boolean",
          description:
            "Set to true to completely remove the recurring configuration from this item.",
        },
        allow_past: {
          type: "boolean",
          description:
            "Only when the user explicitly wants a date before today (e.g. logging something already done). " +
            "Without it, a past day is refused.",
        },
        status: {
          type: "string",
          enum: [...SETTABLE_ITEM_STATUSES],
          description:
            "New status. 'on hold' pauses the item's reminders until its status changes; it's what the user means by snooze, pause or put on hold.",
        },
        properties: {
          type: ["object", "null"],
          description:
            "Custom field values to change, as field key-value pairs; fields left out keep their value. " +
            "Pass null to clear all of them.",
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
      "Move an item to the trash. " +
      "Use this when the user asks to remove, delete, or get rid of an item. " +
      "The user can restore it from the trash for 30 days; after that it is deleted for good.",
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
      ITEM_RESULT +
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
      ITEM_RESULT +
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
            "'overdue' = deadline already passed (including earlier today), 'today' = due today (including ones already overdue), 'tomorrow' = due tomorrow, " +
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

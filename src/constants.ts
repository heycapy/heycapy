export const APP_NAME = "HeyCapy";
export const APP_DOMAIN = "heycapy.xyz";
export const APP_EMAIL_FROM = `${APP_NAME} <noreply@${APP_DOMAIN}>`;
export const APP_TAGLINE = "a capy to help you with your day.";

// Indexed like Date.getDay(): 0 = Sunday
export const WEEKDAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export const WORK_WEEK = [1, 2, 3, 4, 5];
export const LAST_DAY_OF_MONTH = 31;
export const TRASH_RETENTION_DAYS = 30;
export const TODAY_FETCH_AHEAD_DAYS = 1;
export const SEARCH_RESULTS_MAX = 50;

export const OG_COLORS = {
  background: "#1d1816",
  foreground: "#d6c7a9",
  muted: "#bda675",
} as const;

// Emails; the capy theme, as hex because mail clients ignore CSS variables
export const EMAIL_COLORS = {
  page: "#fdf6e3",
  card: "#fffcf4",
  border: "#e8dcc0",
  text: "#2c1f0e",
  muted: "#8a7a63",
  accent: "#7c4b2a",
  panel: "#f5ecd6",
} as const;

// External API base URLs
export const TELEGRAM_API_BASE = "https://api.telegram.org";
export const TELEGRAM_LINK_BASE = "https://t.me";
export const USELESS_FACTS_API_URL = "https://uselessfacts.jsph.pl/api/v2/facts/random?language=en";
export const GROQ_API_BASE = "https://api.groq.com/openai/v1";
export const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/openai/";

// Default service URLs
export const OLLAMA_DEFAULT_URL = "https://ollama.yourdomain.com";
export const NTFY_DEFAULT_URL = "https://ntfy.sh";

// Built-in item statuses; "on hold" pauses reminders until changed
export const ITEM_STATUS = {
  active: "active",
  completed: "completed",
  onHold: "on hold",
  missed: "missed",
} as const;

// No longer open: done, or a repeating occurrence that passed without being done
export const CLOSED_ITEM_STATUSES: readonly string[] = [ITEM_STATUS.completed, ITEM_STATUS.missed];

export function isClosedStatus(status: string): boolean {
  return CLOSED_ITEM_STATUSES.includes(status);
}

export const WEBHOOK_KEY_PREFIX = "hc_live_";
// Telegram command limit
export const TELEGRAM_ALIAS_MAX_LENGTH = 32;
export const WEBHOOK_KEY_MASK = WEBHOOK_KEY_PREFIX + "•".repeat(32);

// Aliases must not shadow these
export const TELEGRAM_RESERVED_COMMANDS = [
  "start",
  "add",
  "help",
  "buckets",
  "list",
  "list_items",
  "due",
  "overdue",
] as const;

// Item / bucket field limits
export const ITEM_TITLE_MAX_LENGTH = 500;
export const BUCKET_NAME_MAX_LENGTH = 100;
export const DUPLICATE_BUCKET_NAME_ERROR = "A bucket with this name already exists.";
export const FIELD_LABEL_MAX_LENGTH = 100;
export const STATUS_NAME_MAX_LENGTH = 50;

// Settings field limits
export const PERSONALITY_NAME_MAX_LENGTH = 50;
export const CUSTOM_PROMPT_MAX_LENGTH = 1000;

export const AI_MODEL_MAX_LENGTH = 500;
export const SETTINGS_URL_MAX_LENGTH = 500;
export const SETTINGS_API_KEY_MAX_LENGTH = 500;

export const NTFY_TOPIC_MAX_LENGTH = 100;
export const TIMEZONE_MAX_LENGTH = 50;
export const TELEGRAM_CHAT_ID_MAX_LENGTH = 50;

// One-time link that connects a Telegram chat to an account
export const TELEGRAM_LINK_TTL_MS = 15 * 60 * 1000;

export const RELATIVE_DAY_NAMES: Record<number, string> = {
  [-1]: "yesterday",
  0: "today",
  1: "tomorrow",
};

export const MONTH_SHORT_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export const SYSTEM_ERRORS_KEPT_MS = 14 * 24 * 60 * 60 * 1000;
export const SYSTEM_ERROR_MESSAGE_MAX = 2000;
export const SYSTEM_ERRORS_SHOWN = 50;
export const ADMIN_ALERT_TIMEOUT_MS = 15_000;
export const ADMIN_DIGEST_MAX_ERRORS = 30;
export const STACK_LINES_IN_ALERT = 12;
export const TELEGRAM_MESSAGE_MAX = 4000;

export const MOBILE_MEDIA_QUERY = "(max-width: 639px)";
export const BOTTOM_BAR_MEDIA_QUERY = "(max-width: 767px)";

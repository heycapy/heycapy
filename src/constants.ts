export const APP_NAME = "HeyCapy";
export const APP_DOMAIN = "heycapy.xyz";
export const APP_EMAIL_FROM = `${APP_NAME} <noreply@${APP_DOMAIN}>`;
export const APP_TAGLINE = "a capy to help you with your day.";

// Indexed like Date.getDay(): 0 = Sunday
export const WEEKDAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export const WEEKDAY_SHORT_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const QUICK_DATES = [
  { label: "due today", days: 0 },
  { label: "due tomorrow", days: 1 },
  { label: "due next week", days: 7 },
] as const;
export const WORK_WEEK = [1, 2, 3, 4, 5];
export const LAST_DAY_OF_MONTH = 31;
export const TRASH_RETENTION_DAYS = 30;
export const TODAY_FETCH_AHEAD_DAYS = 1;
export const SEARCH_RESULTS_MAX = 50;

// Dates typed into an item's title
// Short day names that are also everyday words ("sat exam", "sun cream"); typed alone they're left as text
export const TITLE_DATE_AMBIGUOUS_WORDS = ["sat", "sun", "wed", "now"];
// Removed with the date so "pay rent by friday" becomes "pay rent"
export const TITLE_DATE_LEAD_WORDS = ["by", "on", "at", "due", "before"];
// A time of day given in words; the date library's time for it is kept
export const TITLE_DATE_TIME_WORDS = /\b(morning|afternoon|evening|tonight|night)\b/i;
// The library's "morning" is 6am; ours matches the 9am a picked date starts at
export const TITLE_DATE_MORNING = /\bmorning\b/i;
export const TITLE_DATE_MORNING_HOUR = 9;

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
// Per AI call; the SDKs give up at the same time, so a rate limit shows as itself, not as a timeout
export const AI_REQUEST_TIMEOUT_MS = 30_000;
export const OLLAMA_REQUEST_TIMEOUT_MS = 120_000;
export const AI_KEY_CHECK_TIMEOUT_MS = 15_000;
export const AI_TIMEOUT_ERROR = "The AI provider didn't answer in time. Try again.";
export const AGENT_MAX_ROUNDS = 8;
// How many chat messages may follow the summary before older ones are folded into it
export const AI_COMPACT_THRESHOLD_MIN = 10;
export const AI_COMPACT_THRESHOLD_MAX = 500;
// only on a hosted server for answers on our ai and placeholder amounts until real prices exist
export const CREDITS_FREE_GRANT = 50;
export const CREDITS_PER_MESSAGE = 1;
export const CREDITS_ADMIN_MAX_CHANGE = 100_000;
export const CREDITS_NOTE_MAX_LENGTH = 200;
export const CREDITS_ROWS_SHOWN = 10;
export const OUT_OF_CREDITS_ERROR =
  "You're out of capy credits. Add your own AI key in tweaks → ai to keep chatting (Gemini has a free tier).";
// Safari holds back the first 1 KB of a streamed response, which would hide the first status lines
export const CHAT_STREAM_PADDING = " ".repeat(1024) + "\n";
export const GROQ_API_BASE = "https://api.groq.com/openai/v1";
export const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/openai/";
// the gemini native api takes browser webm and mp4 recordings as they are unlike the openai compatible one
export const GEMINI_NATIVE_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
export const GEMINI_DEFAULT_MODEL = "gemini-3.5-flash-lite";
export const TRANSCRIPTION_PROVIDERS = ["groq", "openai", "gemini"] as const;
export type TranscriptionProvider = (typeof TRANSCRIPTION_PROVIDERS)[number];
export const TRANSCRIPTION_DEFAULT_MODELS: Record<TranscriptionProvider, string> = {
  groq: "whisper-large-v3-turbo",
  openai: "whisper-1",
  gemini: GEMINI_DEFAULT_MODEL,
};
export const VOICE_MAX_SECONDS = 120;
// two minutes of safari aac at 128 kbps with room to spare
export const VOICE_MAX_BYTES = 3 * 1024 * 1024;
export const VOICE_TOO_LONG_ERROR = "Recordings can be up to 2 minutes.";
// titles longer than this are sentences not names
export const VOICE_HINT_ITEMS = 20;
export const VOICE_HINT_MAX_LENGTH = 60;

export const WHISPER_PROMPT_MAX_LENGTH = 600;
export const VOICE_NO_SPEECH_ERROR =
  "capy didn't hear anything. Try again a bit closer to the mic.";

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

// "missed" is only ever set by the scheduler
export const SETTABLE_ITEM_STATUSES: readonly string[] = [
  ITEM_STATUS.active,
  ITEM_STATUS.completed,
  ITEM_STATUS.onHold,
];

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

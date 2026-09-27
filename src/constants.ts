export const APP_NAME = "HeyCapy";
export const APP_DOMAIN = "heycapy.xyz";
export const APP_EMAIL_FROM = `${APP_NAME} <noreply@${APP_DOMAIN}>`;

// External API base URLs
export const TELEGRAM_API_BASE = "https://api.telegram.org";
export const USELESS_FACTS_API_URL = "https://uselessfacts.jsph.pl/api/v2/facts/random?language=en";
export const GROQ_API_BASE = "https://api.groq.com/openai/v1";
export const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/openai/";

// Default service URLs
export const OLLAMA_DEFAULT_URL = "https://ollama.yourdomain.com";
export const NTFY_DEFAULT_URL = "https://ntfy.sh";

export const WEBHOOK_KEY_PREFIX = "hc_live_";
// Telegram bot command names are 1-32 lowercase letters, digits or underscores
export const TELEGRAM_ALIAS_MAX_LENGTH = 32;
export const WEBHOOK_KEY_MASK = WEBHOOK_KEY_PREFIX + "•".repeat(32);

// Built-in telegram bot commands — bucket aliases must not shadow these
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

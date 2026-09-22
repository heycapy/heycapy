import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// users

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// user_settings

export const userSettings = sqliteTable("user_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  theme: text("theme", {
    enum: [
      "capy",
      "light",
      "dark",
      "gruvbox",
      "gruvbox-light",
      "gruvbox-dark-2",
      "terminal",
      "everforest-dark",
      "tokyonight",
      "rosepine",
      "rosepine-dark",
      "nord",
      "dracula",
      "solarized-dark",
      "catppuccin-mocha",
      "one-dark",
      "nightowl",
      "midnight",
    ],
  })
    .notNull()
    .default("capy"),
  timezone: text("timezone").notNull().default("UTC"),
  personalityName: text("personality_name").notNull().default("Capy"),
  personalityTone: text("personality_tone", {
    enum: ["chill", "professional", "motivational", "custom"],
  })
    .notNull()
    .default("chill"),
  personalityEmoji: integer("personality_emoji", { mode: "boolean" }).notNull().default(true),
  personalityCustomPrompt: text("personality_custom_prompt"),
  aiProvider: text("ai_provider", { enum: ["ollama", "openai", "anthropic", "groq", "gemini"] }),
  aiApiKey: text("ai_api_key"),
  aiModel: text("ai_model"),
  aiOllamaUrl: text("ai_ollama_url"),
  aiCompactThreshold: integer("ai_compact_threshold").notNull().default(40),
  notificationsEmail: integer("notifications_email", { mode: "boolean" }).notNull().default(true),
  notificationsPush: integer("notifications_push", { mode: "boolean" }).notNull().default(true),
  ntfyUrl: text("ntfy_url"),
  ntfyTopic: text("ntfy_topic"),
  telegramBotToken: text("telegram_bot_token"),
  telegramChatId: text("telegram_chat_id"),
  notificationsTelegram: integer("notifications_telegram", { mode: "boolean" })
    .notNull()
    .default(false),
  transcriptionProvider: text("transcription_provider"),
  transcriptionApiKey: text("transcription_api_key"),
  transcriptionModel: text("transcription_model"),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// auth_rate_limits

export const authRateLimits = sqliteTable("auth_rate_limits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  otpSendCount: integer("otp_send_count").notNull().default(0),
  otpSendWindowStart: integer("otp_send_window_start", { mode: "timestamp" }),
  verifyFailCount: integer("verify_fail_count").notNull().default(0),
  lockedUntil: integer("locked_until", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// otps

export const otps = sqliteTable("otps", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull(),
  code: text("code").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  usedAt: integer("used_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// item_statuses — system statuses (active/completed/archived/snoozed) + user-created

export const itemStatuses = sqliteTable("item_statuses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#737373"),
  sortOrder: integer("sort_order").notNull().default(0),
  isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false),
});

// buckets

export const buckets = sqliteTable("buckets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  icon: text("icon"),
  color: text("color"),
  notificationsRules: text("notifications_rules").notNull().default("{}"),
  itemsRules: text("items_rules").notNull().default("{}"),
  mcpRules: text("mcp_rules"),
  personalityRules: text("personality_rules").notNull().default("{}"),
  mcpIntegration: text("mcp_integration"),
  mcpConfig: text("mcp_config"),
  lastSyncedAt: integer("last_synced_at", { mode: "timestamp" }),
  isPrivate: integer("is_private", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  archivedAt: integer("archived_at", { mode: "timestamp" }),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// items

export const items = sqliteTable("items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bucketId: integer("bucket_id")
    .notNull()
    .references(() => buckets.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  deadline: integer("deadline", { mode: "timestamp" }),
  status: text("status").notNull().default("active"),
  notificationOffsetMins: integer("notification_offset_mins"),
  notifiedAt: integer("notified_at", { mode: "timestamp" }),
  snoozedUntil: integer("snoozed_until", { mode: "timestamp" }),
  sortOrder: integer("sort_order").notNull().default(0),
  recurring: text("recurring"),
  source: text("source", { enum: ["manual", "ai", "mcp"] })
    .notNull()
    .default("manual"),
  externalId: text("external_id"),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// notification_log

export const notificationLog = sqliteTable("notification_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  itemId: integer("item_id").references(() => items.id, { onDelete: "set null" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  medium: text("medium", { enum: ["email", "ntfy", "telegram"] }).notNull(),
  message: text("message").notNull(),
  status: text("status", { enum: ["sent", "failed"] })
    .notNull()
    .default("sent"),
  error: text("error"),
  sentAt: integer("sent_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// chat_sessions

export const chatSessions = sqliteTable("chat_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  source: text("source", { enum: ["web", "telegram"] })
    .notNull()
    .default("web"),
  summary: text("summary"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// chat_messages

export const chatMessages = sqliteTable("chat_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id")
    .notNull()
    .references(() => chatSessions.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// templates — builtin (seeded) + user-created

export const templates = sqliteTable("templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  rulesJson: text("rules_json").notNull(),
  isBuiltin: integer("is_builtin", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

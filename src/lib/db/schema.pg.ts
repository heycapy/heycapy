import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { BucketSchema } from "@/types/rules";

// users

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// user_settings

export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  theme: text("theme").notNull().default("capy"),
  timezone: text("timezone").notNull().default("UTC"),
  personalityName: text("personality_name").notNull().default("Capy"),
  personalityTone: text("personality_tone").notNull().default("chill"),
  personalityEmoji: boolean("personality_emoji").notNull().default(true),
  personalityCustomPrompt: text("personality_custom_prompt"),
  aiProvider: text("ai_provider"),
  aiApiKey: text("ai_api_key"),
  aiModel: text("ai_model"),
  aiOllamaUrl: text("ai_ollama_url"),
  aiCompactThreshold: integer("ai_compact_threshold").notNull().default(40),
  notificationsEmail: boolean("notifications_email").notNull().default(true),
  notificationsPush: boolean("notifications_push").notNull().default(true),
  ntfyUrl: text("ntfy_url"),
  ntfyTopic: text("ntfy_topic"),
  telegramBotToken: text("telegram_bot_token"),
  telegramChatId: text("telegram_chat_id"),
  notificationsTelegram: boolean("notifications_telegram").notNull().default(false),
  transcriptionProvider: text("transcription_provider"),
  transcriptionApiKey: text("transcription_api_key"),
  transcriptionModel: text("transcription_model"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// auth_rate_limits

export const authRateLimits = pgTable("auth_rate_limits", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  otpSendCount: integer("otp_send_count").notNull().default(0),
  otpSendWindowStart: timestamp("otp_send_window_start"),
  verifyFailCount: integer("verify_fail_count").notNull().default(0),
  lockedUntil: timestamp("locked_until"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// otps

export const otps = pgTable("otps", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// buckets

export const buckets = pgTable("buckets", {
  id: serial("id").primaryKey(),
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
  fieldSchema: text("field_schema").$type<BucketSchema>(),
  webhookKey: text("webhook_key"),
  mcpIntegration: text("mcp_integration"),
  mcpConfig: text("mcp_config"),
  lastSyncedAt: timestamp("last_synced_at"),
  isPrivate: boolean("is_private").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  archivedAt: timestamp("archived_at"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// items

export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  bucketId: integer("bucket_id")
    .notNull()
    .references(() => buckets.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  deadline: timestamp("deadline"),
  status: text("status").notNull().default("active"),
  properties: text("properties"),
  externalId: text("external_id"),
  externalUrl: text("external_url"),
  notificationOffsetMins: integer("notification_offset_mins"),
  notifiedAt: timestamp("notified_at"),
  overdueNotifiedAt: timestamp("overdue_notified_at"),
  snoozedUntil: timestamp("snoozed_until"),
  sortOrder: integer("sort_order").notNull().default(0),
  recurring: text("recurring"),
  source: text("source").notNull().default("manual"),
  completedAt: timestamp("completed_at"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// notification_queue — reliable delivery with retries

export const notificationQueue = pgTable("notification_queue", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  itemId: integer("item_id").references(() => items.id, { onDelete: "set null" }),
  medium: text("medium").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  nextRetryAt: timestamp("next_retry_at"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  sentAt: timestamp("sent_at"),
});

// notification_log — immutable audit trail

export const notificationLog = pgTable("notification_log", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").references(() => items.id, { onDelete: "set null" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  medium: text("medium").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("sent"),
  error: text("error"),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
});

// chat_sessions

export const chatSessions = pgTable("chat_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  source: text("source").notNull().default("web"),
  summary: text("summary"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// chat_messages

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => chatSessions.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// templates

export const templates = pgTable("templates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  rulesJson: text("rules_json").notNull(),
  fieldSchemaJson: text("field_schema_json"),
  isBuiltin: boolean("is_builtin").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Re-export sql for use elsewhere
export { sql };

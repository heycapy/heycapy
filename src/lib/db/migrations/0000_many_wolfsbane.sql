CREATE TABLE `auth_rate_limits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`otp_send_count` integer DEFAULT 0 NOT NULL,
	`otp_send_window_start` integer,
	`verify_fail_count` integer DEFAULT 0 NOT NULL,
	`locked_until` integer,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_rate_limits_email_unique` ON `auth_rate_limits` (`email`);--> statement-breakpoint
CREATE TABLE `buckets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`icon` text,
	`color` text,
	`notifications_rules` text DEFAULT '{}' NOT NULL,
	`items_rules` text DEFAULT '{}' NOT NULL,
	`mcp_rules` text,
	`personality_rules` text DEFAULT '{}' NOT NULL,
	`field_schema` text,
	`webhook_key` text,
	`mcp_integration` text,
	`mcp_config` text,
	`last_synced_at` integer,
	`is_private` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`archived_at` integer,
	`deleted_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `chat_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `chat_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`title` text NOT NULL,
	`source` text DEFAULT 'web' NOT NULL,
	`summary` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bucket_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`deadline` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`properties` text,
	`external_id` text,
	`external_url` text,
	`notification_offset_mins` integer,
	`notified_at` integer,
	`snoozed_until` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`recurring` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`completed_at` integer,
	`deleted_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`bucket_id`) REFERENCES `buckets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notification_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` integer,
	`user_id` integer NOT NULL,
	`medium` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'sent' NOT NULL,
	`error` text,
	`sent_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notification_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`item_id` integer,
	`medium` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`next_retry_at` integer,
	`last_error` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`sent_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `otps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`code` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`name` text NOT NULL,
	`description` text,
	`rules_json` text NOT NULL,
	`field_schema_json` text,
	`is_builtin` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`theme` text DEFAULT 'capy' NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`personality_name` text DEFAULT 'Capy' NOT NULL,
	`personality_tone` text DEFAULT 'chill' NOT NULL,
	`personality_emoji` integer DEFAULT true NOT NULL,
	`personality_custom_prompt` text,
	`ai_provider` text,
	`ai_api_key` text,
	`ai_model` text,
	`ai_ollama_url` text,
	`ai_compact_threshold` integer DEFAULT 40 NOT NULL,
	`notifications_email` integer DEFAULT true NOT NULL,
	`notifications_push` integer DEFAULT true NOT NULL,
	`ntfy_url` text,
	`ntfy_topic` text,
	`telegram_bot_token` text,
	`telegram_chat_id` text,
	`notifications_telegram` integer DEFAULT false NOT NULL,
	`transcription_provider` text,
	`transcription_api_key` text,
	`transcription_model` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_settings_user_id_unique` ON `user_settings` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
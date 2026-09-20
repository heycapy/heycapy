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
CREATE TABLE `item_statuses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#737373' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_system` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bucket_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`title` text NOT NULL,
	`deadline` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`notification_offset_mins` integer,
	`notified_at` integer,
	`snoozed_until` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`recurring` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`external_id` text,
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
	`sent_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
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
	`notifications_email` integer DEFAULT true NOT NULL,
	`notifications_push` integer DEFAULT true NOT NULL,
	`ntfy_url` text,
	`ntfy_topic` text,
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

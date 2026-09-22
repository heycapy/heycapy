ALTER TABLE `user_settings` ADD `telegram_bot_token` text;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `telegram_chat_id` text;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `notifications_telegram` integer DEFAULT false NOT NULL;
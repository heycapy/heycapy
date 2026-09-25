ALTER TABLE `user_settings` ADD `ai_notify_messages` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `user_settings` DROP COLUMN `telegram_bot_token`;
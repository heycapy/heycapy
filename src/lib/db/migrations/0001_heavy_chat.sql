ALTER TABLE `notification_log` ADD `status` text DEFAULT 'sent' NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_log` ADD `error` text;

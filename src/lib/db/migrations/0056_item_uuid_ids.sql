CREATE TABLE `__item_ids` (
	`old_id` integer PRIMARY KEY NOT NULL,
	`new_id` text NOT NULL UNIQUE
);--> statement-breakpoint
INSERT INTO `__item_ids` (`old_id`, `new_id`)
SELECT `id`, printf('%08x-%04x-7%03x-%s%03x-%s', (`created_at` * 1000) >> 16, (`created_at` * 1000) & 65535, `id` % 4096, substr('89ab', 1 + (random() & 3), 1), random() & 4095, lower(hex(randomblob(6))))
FROM `items`;--> statement-breakpoint
CREATE TABLE `__new_items` (
	`id` text PRIMARY KEY NOT NULL,
	`bucket_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`deadline` integer,
	`deadline_timezone` text,
	`scheduled_at` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`properties` text,
	`external_id` text,
	`external_url` text,
	`reminder_offsets` text,
	`notified_at` integer,
	`overdue_notified_at` integer,
	`remind_not_before` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`recurring` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`completed_at` integer,
	`completed_by` integer,
	`deleted_at` integer,
	`deleted_by` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`bucket_id`) REFERENCES `buckets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`completed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
INSERT INTO `__new_items` (`id`, `bucket_id`, `user_id`, `title`, `description`, `deadline`, `deadline_timezone`, `scheduled_at`, `status`, `properties`, `external_id`, `external_url`, `reminder_offsets`, `notified_at`, `overdue_notified_at`, `remind_not_before`, `sort_order`, `recurring`, `source`, `completed_at`, `completed_by`, `deleted_at`, `deleted_by`, `created_at`, `updated_at`)
SELECT m.`new_id`, i.`bucket_id`, i.`user_id`, i.`title`, i.`description`, i.`deadline`, i.`deadline_timezone`, i.`scheduled_at`, i.`status`, i.`properties`, i.`external_id`, i.`external_url`, i.`reminder_offsets`, i.`notified_at`, i.`overdue_notified_at`, i.`remind_not_before`, i.`sort_order`, i.`recurring`, i.`source`, i.`completed_at`, i.`completed_by`, i.`deleted_at`, i.`deleted_by`, i.`created_at`, i.`updated_at`
FROM `items` i JOIN `__item_ids` m ON m.`old_id` = i.`id`;--> statement-breakpoint
CREATE TABLE `__new_item_actions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`item_id` text NOT NULL,
	`action` text NOT NULL,
	`source` text NOT NULL,
	`remind_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `__new_items`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT INTO `__new_item_actions` (`id`, `user_id`, `item_id`, `action`, `source`, `remind_at`, `created_at`)
SELECT c.`id`, c.`user_id`, m.`new_id`, c.`action`, c.`source`, c.`remind_at`, c.`created_at`
FROM `item_actions` c JOIN `__item_ids` m ON m.`old_id` = c.`item_id`;--> statement-breakpoint
CREATE TABLE `__new_item_assignees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` text NOT NULL,
	`user_id` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `__new_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT INTO `__new_item_assignees` (`id`, `item_id`, `user_id`)
SELECT c.`id`, m.`new_id`, c.`user_id`
FROM `item_assignees` c JOIN `__item_ids` m ON m.`old_id` = c.`item_id`;--> statement-breakpoint
CREATE TABLE `__new_item_reminders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`notified_at` integer,
	`overdue_notified_at` integer,
	`next_reminder_at` integer,
	`next_overdue_at` integer,
	FOREIGN KEY (`item_id`) REFERENCES `__new_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT INTO `__new_item_reminders` (`id`, `item_id`, `user_id`, `notified_at`, `overdue_notified_at`, `next_reminder_at`, `next_overdue_at`)
SELECT c.`id`, m.`new_id`, c.`user_id`, c.`notified_at`, c.`overdue_notified_at`, c.`next_reminder_at`, c.`next_overdue_at`
FROM `item_reminders` c JOIN `__item_ids` m ON m.`old_id` = c.`item_id`;--> statement-breakpoint
CREATE TABLE `__new_notification_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` text,
	`user_id` integer NOT NULL,
	`medium` text NOT NULL,
	`webhook_id` integer,
	`message` text NOT NULL,
	`status` text DEFAULT 'sent' NOT NULL,
	`error` text,
	`sent_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `__new_items`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`webhook_id`) REFERENCES `outgoing_webhooks`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
INSERT INTO `__new_notification_log` (`id`, `item_id`, `user_id`, `medium`, `webhook_id`, `message`, `status`, `error`, `sent_at`)
SELECT c.`id`, m.`new_id`, c.`user_id`, c.`medium`, c.`webhook_id`, c.`message`, c.`status`, c.`error`, c.`sent_at`
FROM `notification_log` c LEFT JOIN `__item_ids` m ON m.`old_id` = c.`item_id`;--> statement-breakpoint
CREATE TABLE `__new_notification_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`item_id` text,
	`medium` text NOT NULL,
	`webhook_id` integer,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`kind` text,
	`skip_reason` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`next_retry_at` integer,
	`last_error` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`sent_at` integer,
	`dismissed_at` integer,
	`telegram_message_id` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `__new_items`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`webhook_id`) REFERENCES `outgoing_webhooks`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
INSERT INTO `__new_notification_queue` (`id`, `user_id`, `item_id`, `medium`, `webhook_id`, `title`, `message`, `status`, `kind`, `skip_reason`, `attempts`, `max_attempts`, `next_retry_at`, `last_error`, `created_at`, `sent_at`, `dismissed_at`, `telegram_message_id`)
SELECT c.`id`, c.`user_id`, m.`new_id`, c.`medium`, c.`webhook_id`, c.`title`, c.`message`, c.`status`, c.`kind`, c.`skip_reason`, c.`attempts`, c.`max_attempts`, c.`next_retry_at`, c.`last_error`, c.`created_at`, c.`sent_at`, c.`dismissed_at`, c.`telegram_message_id`
FROM `notification_queue` c LEFT JOIN `__item_ids` m ON m.`old_id` = c.`item_id`;--> statement-breakpoint
CREATE TABLE `__guard` (`ok` integer NOT NULL CHECK (`ok` = 1));--> statement-breakpoint
INSERT INTO `__guard` (`ok`) SELECT
	(SELECT count(*) FROM `items`) = (SELECT count(*) FROM `__new_items`)
	AND (SELECT count(*) FROM `item_actions`) = (SELECT count(*) FROM `__new_item_actions`)
	AND (SELECT count(*) FROM `item_assignees`) = (SELECT count(*) FROM `__new_item_assignees`)
	AND (SELECT count(*) FROM `item_reminders`) = (SELECT count(*) FROM `__new_item_reminders`)
	AND (SELECT count(*) FROM `notification_log`) = (SELECT count(*) FROM `__new_notification_log`)
	AND (SELECT count(*) FROM `notification_queue`) = (SELECT count(*) FROM `__new_notification_queue`)
	AND (SELECT count(*) FROM `notification_log` WHERE `item_id` IS NOT NULL) = (SELECT count(*) FROM `__new_notification_log` WHERE `item_id` IS NOT NULL)
	AND (SELECT count(*) FROM `notification_queue` WHERE `item_id` IS NOT NULL) = (SELECT count(*) FROM `__new_notification_queue` WHERE `item_id` IS NOT NULL)
	AND NOT EXISTS (SELECT 1 FROM `items` i WHERE i.`assignee_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `item_assignees` a WHERE a.`item_id` = i.`id` AND a.`user_id` = i.`assignee_id`));--> statement-breakpoint
DROP TABLE `item_actions`;--> statement-breakpoint
DROP TABLE `item_assignees`;--> statement-breakpoint
DROP TABLE `item_reminders`;--> statement-breakpoint
DROP TABLE `notification_log`;--> statement-breakpoint
DROP TABLE `notification_queue`;--> statement-breakpoint
DROP TABLE `items`;--> statement-breakpoint
ALTER TABLE `__new_items` RENAME TO `items`;--> statement-breakpoint
ALTER TABLE `__new_item_actions` RENAME TO `item_actions`;--> statement-breakpoint
ALTER TABLE `__new_item_assignees` RENAME TO `item_assignees`;--> statement-breakpoint
ALTER TABLE `__new_item_reminders` RENAME TO `item_reminders`;--> statement-breakpoint
ALTER TABLE `__new_notification_log` RENAME TO `notification_log`;--> statement-breakpoint
ALTER TABLE `__new_notification_queue` RENAME TO `notification_queue`;--> statement-breakpoint
CREATE INDEX `idx_item_actions_item_id` ON `item_actions` (`item_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_item_assignees_item_user` ON `item_assignees` (`item_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_item_assignees_user_id` ON `item_assignees` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_item_reminders_item_user` ON `item_reminders` (`item_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_item_reminders_user_id` ON `item_reminders` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_item_reminders_next_reminder_at` ON `item_reminders` (`next_reminder_at`);--> statement-breakpoint
CREATE INDEX `idx_item_reminders_next_overdue_at` ON `item_reminders` (`next_overdue_at`);--> statement-breakpoint
CREATE TRIGGER `items_notified_at_for_everyone` AFTER UPDATE OF `notified_at` ON `items` BEGIN
	UPDATE `item_reminders` SET `notified_at` = NEW.`notified_at` WHERE `item_id` = NEW.`id`;
END;--> statement-breakpoint
CREATE TRIGGER `items_overdue_notified_at_for_everyone` AFTER UPDATE OF `overdue_notified_at` ON `items` BEGIN
	UPDATE `item_reminders` SET `overdue_notified_at` = NEW.`overdue_notified_at` WHERE `item_id` = NEW.`id`;
END;--> statement-breakpoint
INSERT INTO `__guard` (`ok`) SELECT (SELECT count(*) FROM pragma_foreign_key_check) = 0;--> statement-breakpoint
DROP TABLE `__guard`;--> statement-breakpoint
DROP TABLE `__item_ids`;
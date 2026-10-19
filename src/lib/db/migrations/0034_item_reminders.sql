CREATE TABLE `item_reminders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`notified_at` integer,
	`overdue_notified_at` integer,
	`next_reminder_at` integer,
	`next_overdue_at` integer,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_item_reminders_item_user` ON `item_reminders` (`item_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_item_reminders_user_id` ON `item_reminders` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_item_reminders_next_reminder_at` ON `item_reminders` (`next_reminder_at`);--> statement-breakpoint
CREATE INDEX `idx_item_reminders_next_overdue_at` ON `item_reminders` (`next_overdue_at`);--> statement-breakpoint
INSERT INTO `item_reminders` (`item_id`, `user_id`, `notified_at`, `overdue_notified_at`, `next_reminder_at`, `next_overdue_at`) SELECT `items`.`id`, `bucket_members`.`user_id`, `items`.`notified_at`, `items`.`overdue_notified_at`, CASE WHEN `bucket_members`.`user_id` = `items`.`user_id` THEN `items`.`next_reminder_at` END, CASE WHEN `bucket_members`.`user_id` = `items`.`user_id` THEN `items`.`next_overdue_at` END FROM `items` JOIN `bucket_members` ON `bucket_members`.`bucket_id` = `items`.`bucket_id` WHERE `items`.`assignee_id` IS NULL OR `items`.`assignee_id` = `bucket_members`.`user_id` OR NOT EXISTS (SELECT 1 FROM `bucket_members` AS `assignee` WHERE `assignee`.`bucket_id` = `items`.`bucket_id` AND `assignee`.`user_id` = `items`.`assignee_id`);--> statement-breakpoint
CREATE TRIGGER `items_notified_at_for_everyone` AFTER UPDATE OF `notified_at` ON `items` BEGIN
	UPDATE `item_reminders` SET `notified_at` = NEW.`notified_at` WHERE `item_id` = NEW.`id`;
END;--> statement-breakpoint
CREATE TRIGGER `items_overdue_notified_at_for_everyone` AFTER UPDATE OF `overdue_notified_at` ON `items` BEGIN
	UPDATE `item_reminders` SET `overdue_notified_at` = NEW.`overdue_notified_at` WHERE `item_id` = NEW.`id`;
END;--> statement-breakpoint
DROP INDEX `idx_items_next_reminder_at`;--> statement-breakpoint
DROP INDEX `idx_items_next_overdue_at`;--> statement-breakpoint
ALTER TABLE `items` DROP COLUMN `next_reminder_at`;--> statement-breakpoint
ALTER TABLE `items` DROP COLUMN `next_overdue_at`;
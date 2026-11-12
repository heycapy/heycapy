CREATE TABLE `item_assignees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_item_assignees_item_user` ON `item_assignees` (`item_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_item_assignees_user_id` ON `item_assignees` (`user_id`);--> statement-breakpoint
INSERT INTO `item_assignees` (`item_id`, `user_id`) SELECT `items`.`id`, `items`.`assignee_id` FROM `items` JOIN `bucket_members` ON `bucket_members`.`bucket_id` = `items`.`bucket_id` AND `bucket_members`.`user_id` = `items`.`assignee_id`;--> statement-breakpoint
UPDATE `items` SET `assignee_id` = NULL;

CREATE TABLE `username_changes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`old_username` text,
	`new_username` text NOT NULL,
	`by_admin` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_username_changes_user_id` ON `username_changes` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_username_changes_old_username` ON `username_changes` (`old_username`,`created_at`);--> statement-breakpoint
ALTER TABLE `users` ADD `username_bonus_changes` integer DEFAULT 0 NOT NULL;
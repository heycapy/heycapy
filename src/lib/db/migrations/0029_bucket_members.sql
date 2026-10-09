CREATE TABLE `bucket_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bucket_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`bucket_id`) REFERENCES `buckets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_bucket_members_bucket_user` ON `bucket_members` (`bucket_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_bucket_members_user_id` ON `bucket_members` (`user_id`);--> statement-breakpoint
INSERT INTO `bucket_members` (`bucket_id`, `user_id`, `role`) SELECT `id`, `user_id`, 'owner' FROM `buckets`;--> statement-breakpoint
CREATE TRIGGER `buckets_owner_member` AFTER INSERT ON `buckets` BEGIN
	INSERT INTO `bucket_members` (`bucket_id`, `user_id`, `role`) VALUES (NEW.`id`, NEW.`user_id`, 'owner');
END;
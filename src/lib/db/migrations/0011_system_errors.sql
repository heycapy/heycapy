CREATE TABLE `system_errors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`level` text DEFAULT 'error' NOT NULL,
	`source` text NOT NULL,
	`message` text NOT NULL,
	`details` text,
	`alerted_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_system_errors_created_at` ON `system_errors` (`created_at`);
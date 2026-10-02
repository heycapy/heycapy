CREATE TABLE `credit_ledger` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`amount` integer NOT NULL,
	`kind` text NOT NULL,
	`refund_of` integer,
	`note` text,
	`actor` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`refund_of`) REFERENCES `credit_ledger`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_credit_ledger_user_id` ON `credit_ledger` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_credit_ledger_refund_of` ON `credit_ledger` (`refund_of`);--> statement-breakpoint
ALTER TABLE `user_settings` ADD `ai_key_status` text;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `ai_key_error` text;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `ai_key_checked_at` integer;
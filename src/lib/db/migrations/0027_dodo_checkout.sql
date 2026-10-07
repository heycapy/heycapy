CREATE TABLE `checkout_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`provider` text NOT NULL,
	`session_id` text NOT NULL,
	`pack` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_checkout_sessions_session` ON `checkout_sessions` (`provider`,`session_id`);--> statement-breakpoint
CREATE INDEX `idx_checkout_sessions_user_id` ON `checkout_sessions` (`user_id`);--> statement-breakpoint
ALTER TABLE `credit_ledger` ADD `provider` text;--> statement-breakpoint
ALTER TABLE `credit_ledger` ADD `provider_ref` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_credit_ledger_provider_ref` ON `credit_ledger` (`provider`,`provider_ref`,`kind`);
CREATE TABLE `auth_rate_limits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`otp_send_count` integer DEFAULT 0 NOT NULL,
	`otp_send_window_start` integer,
	`verify_fail_count` integer DEFAULT 0 NOT NULL,
	`locked_until` integer,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_rate_limits_email_unique` ON `auth_rate_limits` (`email`);
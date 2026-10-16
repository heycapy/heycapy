ALTER TABLE `users` ADD `last_seen_release` text;--> statement-breakpoint
UPDATE `users` SET `last_seen_release` = '0.3.0';

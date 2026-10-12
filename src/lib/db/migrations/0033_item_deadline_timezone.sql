ALTER TABLE `items` ADD `deadline_timezone` text;--> statement-breakpoint
UPDATE `items` SET `deadline_timezone` = COALESCE((SELECT `user_settings`.`timezone` FROM `buckets` JOIN `user_settings` ON `user_settings`.`user_id` = `buckets`.`user_id` WHERE `buckets`.`id` = `items`.`bucket_id`), 'UTC') WHERE `deadline` IS NOT NULL;

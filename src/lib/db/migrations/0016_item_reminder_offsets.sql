ALTER TABLE `items` ADD `reminder_offsets` text;--> statement-breakpoint
UPDATE `items` SET `reminder_offsets` = json_array(`notification_offset_mins`) WHERE `notification_offset_mins` IS NOT NULL;--> statement-breakpoint
ALTER TABLE `items` DROP COLUMN `notification_offset_mins`;

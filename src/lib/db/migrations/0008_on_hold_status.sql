ALTER TABLE `items` RENAME COLUMN `snoozed_until` TO `remind_not_before`;--> statement-breakpoint
UPDATE `items` SET `status` = 'on hold' WHERE `status` = 'snoozed';--> statement-breakpoint
UPDATE `buckets` SET `field_schema` = replace(`field_schema`, '"name":"snoozed"', '"name":"on hold"') WHERE `field_schema` LIKE '%"name":"snoozed"%';--> statement-breakpoint
UPDATE `templates` SET `field_schema_json` = replace(`field_schema_json`, '"name":"snoozed"', '"name":"on hold"') WHERE `field_schema_json` LIKE '%"name":"snoozed"%';

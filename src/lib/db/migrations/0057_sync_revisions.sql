CREATE TABLE `sync_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`rev` integer DEFAULT 0 NOT NULL,
	`min_rev` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "sync_state_one_row" CHECK("sync_state"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE `sync_tombstones` (
	`rev` integer PRIMARY KEY NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text NOT NULL,
	`bucket_id` integer,
	`user_id` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `bucket_members` ADD `rev` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_bucket_members_rev` ON `bucket_members` (`rev`);--> statement-breakpoint
ALTER TABLE `buckets` ADD `rev` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_buckets_rev` ON `buckets` (`rev`);--> statement-breakpoint
ALTER TABLE `item_reminders` ADD `rev` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_item_reminders_rev` ON `item_reminders` (`rev`);--> statement-breakpoint
ALTER TABLE `items` ADD `rev` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_items_rev` ON `items` (`rev`);
--> statement-breakpoint
INSERT INTO `sync_state` (`id`, `rev`, `min_rev`) VALUES (1, 0, 0);--> statement-breakpoint
UPDATE `buckets` SET `rev` = r.`n` FROM (SELECT `id`, row_number() OVER (ORDER BY `id`) AS `n` FROM `buckets`) r WHERE `buckets`.`id` = r.`id`;--> statement-breakpoint
UPDATE `bucket_members` SET `rev` = (SELECT count(*) FROM `buckets`) + r.`n` FROM (SELECT `id`, row_number() OVER (ORDER BY `id`) AS `n` FROM `bucket_members`) r WHERE `bucket_members`.`id` = r.`id`;--> statement-breakpoint
UPDATE `items` SET `rev` = (SELECT count(*) FROM `buckets`) + (SELECT count(*) FROM `bucket_members`) + r.`n` FROM (SELECT `id`, row_number() OVER (ORDER BY `id`) AS `n` FROM `items`) r WHERE `items`.`id` = r.`id`;--> statement-breakpoint
UPDATE `item_reminders` SET `rev` = (SELECT count(*) FROM `buckets`) + (SELECT count(*) FROM `bucket_members`) + (SELECT count(*) FROM `items`) + r.`n` FROM (SELECT `id`, row_number() OVER (ORDER BY `id`) AS `n` FROM `item_reminders`) r WHERE `item_reminders`.`id` = r.`id`;--> statement-breakpoint
UPDATE `sync_state` SET `rev` = (SELECT count(*) FROM `buckets`) + (SELECT count(*) FROM `bucket_members`) + (SELECT count(*) FROM `items`) + (SELECT count(*) FROM `item_reminders`) WHERE `id` = 1;--> statement-breakpoint
CREATE TABLE `__guard` (`ok` integer NOT NULL CHECK (`ok` = 1));--> statement-breakpoint
WITH `r`(`rev`) AS (SELECT `rev` FROM `buckets` UNION ALL SELECT `rev` FROM `bucket_members` UNION ALL SELECT `rev` FROM `items` UNION ALL SELECT `rev` FROM `item_reminders`)
INSERT INTO `__guard` (`ok`) SELECT
	(SELECT count(*) FROM `r`) = (SELECT count(DISTINCT `rev`) FROM `r`)
	AND (SELECT coalesce(min(`rev`), 1) FROM `r`) = 1
	AND (SELECT coalesce(max(`rev`), 0) FROM `r`) = (SELECT `rev` FROM `sync_state` WHERE `id` = 1);--> statement-breakpoint
DROP TABLE `__guard`;--> statement-breakpoint
CREATE TRIGGER `buckets_rev_insert` AFTER INSERT ON `buckets` BEGIN
	UPDATE `sync_state` SET `rev` = `rev` + 1 WHERE `id` = 1;
	UPDATE `buckets` SET `rev` = (SELECT `rev` FROM `sync_state` WHERE `id` = 1) WHERE `id` = NEW.`id`;
END;--> statement-breakpoint
CREATE TRIGGER `buckets_rev_update` AFTER UPDATE ON `buckets` WHEN NEW.`rev` = OLD.`rev` BEGIN
	UPDATE `sync_state` SET `rev` = `rev` + 1 WHERE `id` = 1;
	UPDATE `buckets` SET `rev` = (SELECT `rev` FROM `sync_state` WHERE `id` = 1) WHERE `id` = NEW.`id`;
END;--> statement-breakpoint
CREATE TRIGGER `bucket_members_rev_insert` AFTER INSERT ON `bucket_members` BEGIN
	UPDATE `sync_state` SET `rev` = `rev` + 1 WHERE `id` = 1;
	UPDATE `bucket_members` SET `rev` = (SELECT `rev` FROM `sync_state` WHERE `id` = 1) WHERE `id` = NEW.`id`;
END;--> statement-breakpoint
CREATE TRIGGER `bucket_members_rev_update` AFTER UPDATE ON `bucket_members` WHEN NEW.`rev` = OLD.`rev` BEGIN
	UPDATE `sync_state` SET `rev` = `rev` + 1 WHERE `id` = 1;
	UPDATE `bucket_members` SET `rev` = (SELECT `rev` FROM `sync_state` WHERE `id` = 1) WHERE `id` = NEW.`id`;
END;--> statement-breakpoint
CREATE TRIGGER `items_rev_insert` AFTER INSERT ON `items` BEGIN
	UPDATE `sync_state` SET `rev` = `rev` + 1 WHERE `id` = 1;
	UPDATE `items` SET `rev` = (SELECT `rev` FROM `sync_state` WHERE `id` = 1) WHERE `id` = NEW.`id`;
END;--> statement-breakpoint
CREATE TRIGGER `items_rev_update` AFTER UPDATE ON `items` WHEN NEW.`rev` = OLD.`rev` BEGIN
	UPDATE `sync_state` SET `rev` = `rev` + 1 WHERE `id` = 1;
	UPDATE `items` SET `rev` = (SELECT `rev` FROM `sync_state` WHERE `id` = 1) WHERE `id` = NEW.`id`;
END;--> statement-breakpoint
CREATE TRIGGER `item_reminders_rev_insert` AFTER INSERT ON `item_reminders` BEGIN
	UPDATE `sync_state` SET `rev` = `rev` + 1 WHERE `id` = 1;
	UPDATE `item_reminders` SET `rev` = (SELECT `rev` FROM `sync_state` WHERE `id` = 1) WHERE `id` = NEW.`id`;
END;--> statement-breakpoint
CREATE TRIGGER `item_reminders_rev_update` AFTER UPDATE ON `item_reminders` WHEN NEW.`rev` = OLD.`rev` BEGIN
	UPDATE `sync_state` SET `rev` = `rev` + 1 WHERE `id` = 1;
	UPDATE `item_reminders` SET `rev` = (SELECT `rev` FROM `sync_state` WHERE `id` = 1) WHERE `id` = NEW.`id`;
END;--> statement-breakpoint
CREATE TRIGGER `buckets_tombstone` AFTER DELETE ON `buckets` BEGIN
	UPDATE `sync_state` SET `rev` = `rev` + 1 WHERE `id` = 1;
	INSERT INTO `sync_tombstones` (`rev`, `entity`, `entity_id`, `bucket_id`, `user_id`) VALUES ((SELECT `rev` FROM `sync_state` WHERE `id` = 1), 'bucket', CAST(OLD.`id` AS TEXT), OLD.`id`, NULL);
END;--> statement-breakpoint
CREATE TRIGGER `bucket_members_tombstone` AFTER DELETE ON `bucket_members` BEGIN
	UPDATE `sync_state` SET `rev` = `rev` + 1 WHERE `id` = 1;
	INSERT INTO `sync_tombstones` (`rev`, `entity`, `entity_id`, `bucket_id`, `user_id`) VALUES ((SELECT `rev` FROM `sync_state` WHERE `id` = 1), 'bucket_member', CAST(OLD.`id` AS TEXT), OLD.`bucket_id`, OLD.`user_id`);
END;--> statement-breakpoint
CREATE TRIGGER `items_tombstone` AFTER DELETE ON `items` BEGIN
	UPDATE `sync_state` SET `rev` = `rev` + 1 WHERE `id` = 1;
	INSERT INTO `sync_tombstones` (`rev`, `entity`, `entity_id`, `bucket_id`, `user_id`) VALUES ((SELECT `rev` FROM `sync_state` WHERE `id` = 1), 'item', OLD.`id`, OLD.`bucket_id`, NULL);
END;--> statement-breakpoint
CREATE TRIGGER `item_reminders_tombstone` AFTER DELETE ON `item_reminders` BEGIN
	UPDATE `sync_state` SET `rev` = `rev` + 1 WHERE `id` = 1;
	INSERT INTO `sync_tombstones` (`rev`, `entity`, `entity_id`, `bucket_id`, `user_id`) VALUES ((SELECT `rev` FROM `sync_state` WHERE `id` = 1), 'item_reminder', OLD.`item_id`, NULL, OLD.`user_id`);
END;--> statement-breakpoint
CREATE TRIGGER `item_assignees_touch_insert` AFTER INSERT ON `item_assignees` BEGIN
	UPDATE `sync_state` SET `rev` = `rev` + 1 WHERE `id` = 1;
	UPDATE `items` SET `rev` = (SELECT `rev` FROM `sync_state` WHERE `id` = 1) WHERE `id` = NEW.`item_id`;
END;--> statement-breakpoint
CREATE TRIGGER `item_assignees_touch_update` AFTER UPDATE ON `item_assignees` BEGIN
	UPDATE `sync_state` SET `rev` = `rev` + 1 WHERE `id` = 1;
	UPDATE `items` SET `rev` = (SELECT `rev` FROM `sync_state` WHERE `id` = 1) WHERE `id` = NEW.`item_id`;
END;--> statement-breakpoint
CREATE TRIGGER `item_assignees_touch_delete` AFTER DELETE ON `item_assignees` WHEN EXISTS (SELECT 1 FROM `items` WHERE `id` = OLD.`item_id`) BEGIN
	UPDATE `sync_state` SET `rev` = `rev` + 1 WHERE `id` = 1;
	UPDATE `items` SET `rev` = (SELECT `rev` FROM `sync_state` WHERE `id` = 1) WHERE `id` = OLD.`item_id`;
END;--> statement-breakpoint
CREATE TRIGGER `users_profile_touch_memberships` AFTER UPDATE OF `username`, `avatar` ON `users` BEGIN
	UPDATE `bucket_members` SET `rev` = `rev` WHERE `user_id` = NEW.`id`;
END;
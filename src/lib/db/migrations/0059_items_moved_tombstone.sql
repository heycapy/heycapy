CREATE TRIGGER `items_moved_tombstone` AFTER UPDATE OF `bucket_id` ON `items` WHEN NEW.`bucket_id` <> OLD.`bucket_id` BEGIN
	UPDATE `sync_state` SET `rev` = `rev` + 1 WHERE `id` = 1;
	INSERT INTO `sync_tombstones` (`rev`, `entity`, `entity_id`, `bucket_id`, `user_id`) VALUES ((SELECT `rev` FROM `sync_state` WHERE `id` = 1), 'item', OLD.`id`, OLD.`bucket_id`, NULL);
END;

DELETE FROM `templates` WHERE `is_builtin` = 1 AND `user_id` IS NULL AND `id` NOT IN (SELECT MIN(`id`) FROM `templates` WHERE `is_builtin` = 1 AND `user_id` IS NULL GROUP BY `name`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_templates_builtin_name` ON `templates` (`name`) WHERE `is_builtin` = 1 AND `user_id` IS NULL;

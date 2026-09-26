-- Builtin templates should always be global (user_id IS NULL).
-- Previous versions of seed() inserted them per-user. This removes those orphaned rows.
DELETE FROM `templates` WHERE `is_builtin` = 1 AND `user_id` IS NOT NULL;

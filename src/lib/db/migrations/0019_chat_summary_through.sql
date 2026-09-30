ALTER TABLE `chat_sessions` ADD `summary_through` integer;--> statement-breakpoint
-- Old summaries don't say which messages they cover; the next answer in each chat rebuilds one
UPDATE `chat_sessions` SET `summary` = NULL;

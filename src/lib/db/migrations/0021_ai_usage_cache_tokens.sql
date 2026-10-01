ALTER TABLE `ai_usage` ADD `cache_read_tokens` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_usage` ADD `cache_write_tokens` integer DEFAULT 0 NOT NULL;
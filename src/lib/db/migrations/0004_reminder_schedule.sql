ALTER TABLE `items` ADD `next_reminder_at` integer;--> statement-breakpoint
ALTER TABLE `items` ADD `next_overdue_at` integer;--> statement-breakpoint
CREATE INDEX `idx_items_next_reminder_at` ON `items` (`next_reminder_at`);--> statement-breakpoint
CREATE INDEX `idx_items_next_overdue_at` ON `items` (`next_overdue_at`);
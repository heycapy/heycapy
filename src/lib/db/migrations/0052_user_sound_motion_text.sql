ALTER TABLE `user_settings` ADD `tick_sound` text DEFAULT 'chime' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `reduce_motion` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `text_size` text DEFAULT 'default' NOT NULL;
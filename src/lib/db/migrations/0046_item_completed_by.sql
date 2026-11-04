ALTER TABLE `items` ADD `completed_by` integer REFERENCES users(id) ON DELETE set null;

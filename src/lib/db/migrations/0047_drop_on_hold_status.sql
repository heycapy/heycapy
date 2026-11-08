UPDATE `items` SET `status` = 'active', `updated_at` = unixepoch() WHERE `status` = 'on hold';

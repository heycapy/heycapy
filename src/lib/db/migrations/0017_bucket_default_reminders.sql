UPDATE `buckets` SET `notifications_rules` = json_remove(
  json_set(`notifications_rules`, '$.defaultReminders', json_array(coalesce(json_extract(`notifications_rules`, '$.defaultOffsetMins'), 0))),
  '$.defaultOffsetMins', '$.default_offset'
) WHERE json_valid(`notifications_rules`);--> statement-breakpoint
UPDATE `templates` SET `rules_json` = json_remove(
  json_set(`rules_json`, '$.notifications.defaultReminders', json_array(coalesce(json_extract(`rules_json`, '$.notifications.defaultOffsetMins'), 0))),
  '$.notifications.defaultOffsetMins', '$.notifications.default_offset'
) WHERE json_valid(`rules_json`) AND json_type(`rules_json`, '$.notifications') = 'object';

ALTER TABLE user_settings ADD COLUMN email_provider TEXT;
ALTER TABLE user_settings ADD COLUMN resend_api_key TEXT;
ALTER TABLE user_settings ADD COLUMN smtp_host TEXT;
ALTER TABLE user_settings ADD COLUMN smtp_port INTEGER;
ALTER TABLE user_settings ADD COLUMN smtp_user TEXT;
ALTER TABLE user_settings ADD COLUMN smtp_pass TEXT;
ALTER TABLE user_settings ADD COLUMN smtp_secure INTEGER;
ALTER TABLE user_settings ADD COLUMN smtp_from TEXT;

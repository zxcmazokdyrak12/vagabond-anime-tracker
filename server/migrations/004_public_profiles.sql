-- Публичный профиль /u/:username — только если пользователь сам включил
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

-- Поиск профиля по имени без учёта регистра
CREATE INDEX IF NOT EXISTS users_username_lower_idx ON users (lower(username));

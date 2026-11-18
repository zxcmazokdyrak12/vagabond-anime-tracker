-- Правила, которые раньше жили только в коде, теперь проверяет и сама база.
-- NOT VALID: проверяются только новые и изменённые строки, старые данные не блокируют миграцию.
ALTER TABLE anime_list
  ADD CONSTRAINT anime_list_status_check
  CHECK (status IN ('watching', 'completed', 'planning', 'dropped')) NOT VALID;

ALTER TABLE anime_list
  ADD CONSTRAINT anime_list_watched_check
  CHECK (watched_episodes >= 0) NOT VALID;

-- Список пользователя всегда читается как WHERE user_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS anime_list_user_created_idx
  ON anime_list (user_id, created_at DESC);

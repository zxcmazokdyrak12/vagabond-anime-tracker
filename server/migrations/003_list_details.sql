-- Даты просмотра, заметка, число пересмотров и время последнего изменения.
-- IF NOT EXISTS / DROP IF EXISTS — миграции идемпотентны (см. 002).
ALTER TABLE anime_list
  ADD COLUMN IF NOT EXISTS started_at DATE,
  ADD COLUMN IF NOT EXISTS finished_at DATE,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS rewatch_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();

ALTER TABLE anime_list
  DROP CONSTRAINT IF EXISTS anime_list_rewatch_check,
  ADD CONSTRAINT anime_list_rewatch_check CHECK (rewatch_count >= 0) NOT VALID;

ALTER TABLE anime_list
  DROP CONSTRAINT IF EXISTS anime_list_notes_check,
  ADD CONSTRAINT anime_list_notes_check CHECK (char_length(notes) <= 2000) NOT VALID;

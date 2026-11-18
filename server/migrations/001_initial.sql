-- Исходная схема. IF NOT EXISTS — потому что на проде таблицы уже созданы старым initDB()
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS anime_list (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  anime_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  image TEXT,
  episodes INTEGER,
  status TEXT DEFAULT 'planning',
  score INTEGER CHECK (score >= 1 AND score <= 10),
  watched_episodes INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, anime_id)
);

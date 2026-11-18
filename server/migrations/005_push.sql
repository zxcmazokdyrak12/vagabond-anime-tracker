-- Подписки браузеров на пуш-уведомления (одна на устройство)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions (user_id);

-- О какой серии уже сообщили — чтобы не прислать одно и то же дважды
CREATE TABLE IF NOT EXISTS notified_episodes (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  anime_id INTEGER NOT NULL,
  episode INTEGER NOT NULL,
  notified_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, anime_id, episode)
);

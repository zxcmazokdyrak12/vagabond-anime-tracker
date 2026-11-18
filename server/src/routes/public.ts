import { Router } from 'express'
import type { Db } from '../db.js'
import { asyncHandler } from '../lib/auth.js'
import { STATS_SQL } from './list.js'

/** Публичный профиль: только если владелец сам открыл его. Заметки не показываем */
export function publicRouter({ db }: { db: Db }) {
  const router = Router()

  router.get(
    '/:username',
    asyncHandler(async (req, res) => {
      const username = String(req.params.username).slice(0, 32)
      const { rows: users } = await db.query<{ id: number; username: string; created_at: string }>(
        'SELECT id, username, created_at FROM users WHERE lower(username) = lower($1) AND is_public',
        [username]
      )
      const user = users[0]
      // Одинаковый ответ для «нет такого» и «закрыт» — не раскрываем, кто зарегистрирован
      if (!user) return res.status(404).json({ error: 'This profile is private or does not exist' })

      const [list, stats] = await Promise.all([
        db.query(
          `SELECT anime_id, title, image, episodes, status, score, watched_episodes, finished_at, rewatch_count
           FROM anime_list WHERE user_id = $1 ORDER BY updated_at DESC, id DESC`,
          [user.id]
        ),
        db.query(STATS_SQL, [user.id]),
      ])
      res.set('Cache-Control', 'public, max-age=60')
      res.json({ username: user.username, member_since: user.created_at, stats: stats.rows[0], list: list.rows })
    })
  )

  return router
}

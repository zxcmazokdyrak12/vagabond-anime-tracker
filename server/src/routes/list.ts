import { Router } from 'express'
import type { Db } from '../db.js'
import { asyncHandler, requireAuth, type AuthedRequest } from '../lib/auth.js'
import { isNonNegativeInt, isPositiveInt, isStatus, isValidScore, toIntOrNull } from '../lib/validation.js'

export function listRouter({ db, jwtSecret }: { db: Db; jwtSecret: string }) {
  const router = Router()
  const auth = requireAuth(jwtSecret)

  // Список пользователя
  router.get(
    '/list',
    auth,
    asyncHandler<AuthedRequest>(async (req, res) => {
      const { rows } = await db.query(
        'SELECT * FROM anime_list WHERE user_id = $1 ORDER BY created_at DESC, id DESC',
        [req.user.id]
      )
      res.json(rows)
    })
  )

  // Добавить тайтл
  router.post(
    '/list',
    auth,
    asyncHandler<AuthedRequest>(async (req, res) => {
      const { anime_id, title, image, episodes, status, score } = req.body ?? {}
      const animeId = Number(anime_id)
      const eps = toIntOrNull(episodes)
      const sc = toIntOrNull(score)
      if (!isPositiveInt(animeId) || typeof title !== 'string' || !title.trim())
        return res.status(400).json({ error: 'anime_id and title are required' })
      if (status !== undefined && !isStatus(status)) return res.status(400).json({ error: 'Invalid status' })
      if (!isValidScore(sc)) return res.status(400).json({ error: 'Score must be 1–10' })
      if (eps !== null && !isNonNegativeInt(eps)) return res.status(400).json({ error: 'Invalid episodes' })

      const { rows } = await db.query(
        `INSERT INTO anime_list (user_id, anime_id, title, image, episodes, status, score)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id, anime_id) DO NOTHING
         RETURNING *`,
        [req.user.id, animeId, title.trim(), typeof image === 'string' ? image : null, eps, status ?? 'planning', sc]
      )
      if (!rows[0]) return res.status(409).json({ error: 'Anime already in your list' })
      res.status(201).json(rows[0])
    })
  )

  // Частичное обновление: статус, оценка (null = сбросить), просмотренные серии
  router.patch(
    '/list/:animeId',
    auth,
    asyncHandler<AuthedRequest>(async (req, res) => {
      const animeId = Number(req.params.animeId)
      const body = req.body ?? {}
      if (!isPositiveInt(animeId)) return res.status(400).json({ error: 'Invalid anime id' })
      if (body.status !== undefined && !isStatus(body.status)) return res.status(400).json({ error: 'Invalid status' })

      const scoreProvided = 'score' in body
      const score = scoreProvided ? toIntOrNull(body.score) : null
      if (scoreProvided && !isValidScore(score)) return res.status(400).json({ error: 'Score must be 1–10' })

      const watched = toIntOrNull(body.watched_episodes)
      if (watched !== null && !isNonNegativeInt(watched))
        return res.status(400).json({ error: 'Invalid watched_episodes' })

      const { rows } = await db.query(
        `UPDATE anime_list
         SET status = COALESCE($1, status),
             score = CASE WHEN $2::boolean THEN $3::int ELSE score END,
             watched_episodes = CASE
               WHEN $4::int IS NULL THEN watched_episodes
               WHEN episodes IS NOT NULL THEN LEAST($4::int, episodes)
               ELSE $4::int
             END
         WHERE user_id = $5 AND anime_id = $6
         RETURNING *`,
        [body.status ?? null, scoreProvided, score, watched, req.user.id, animeId]
      )
      if (!rows[0]) return res.status(404).json({ error: 'Anime not in your list' })
      res.json(rows[0])
    })
  )

  router.delete(
    '/list/:animeId',
    auth,
    asyncHandler<AuthedRequest>(async (req, res) => {
      const animeId = Number(req.params.animeId)
      if (!isPositiveInt(animeId)) return res.status(400).json({ error: 'Invalid anime id' })
      const { rowCount } = await db.query('DELETE FROM anime_list WHERE user_id = $1 AND anime_id = $2', [
        req.user.id,
        animeId,
      ])
      if (!rowCount) return res.status(404).json({ error: 'Anime not in your list' })
      res.json({ success: true })
    })
  )

  // Статистика одним агрегирующим запросом
  router.get(
    '/stats',
    auth,
    asyncHandler<AuthedRequest>(async (req, res) => {
      const { rows } = await db.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'watching')::int  AS watching,
           COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
           COUNT(*) FILTER (WHERE status = 'planning')::int  AS planning,
           COUNT(*) FILTER (WHERE status = 'dropped')::int   AS dropped,
           COALESCE(ROUND(AVG(score), 1)::float, 0)          AS avg_score,
           COALESCE(SUM(watched_episodes), 0)::int           AS total_episodes
         FROM anime_list WHERE user_id = $1`,
        [req.user.id]
      )
      res.json(rows[0])
    })
  )

  return router
}

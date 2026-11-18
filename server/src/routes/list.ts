import { Router } from 'express'
import type { Db } from '../db.js'
import { asyncHandler, requireAuth, type AuthedRequest } from '../lib/auth.js'
import { isIsoDate, isNonNegativeInt, isPositiveInt, isStatus, isValidScore, toIntOrNull } from '../lib/validation.js'

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

  // Частичное обновление: меняются только переданные поля (null = очистить, где это допустимо)
  router.patch(
    '/list/:animeId',
    auth,
    asyncHandler<AuthedRequest>(async (req, res) => {
      const animeId = Number(req.params.animeId)
      const body = (req.body ?? {}) as Record<string, unknown>
      if (!isPositiveInt(animeId)) return res.status(400).json({ error: 'Invalid anime id' })

      const sets: string[] = []
      const params: unknown[] = []
      const set = (sql: string, value: unknown) => {
        params.push(value)
        sets.push(sql.replace('?', `$${params.length}`))
      }

      if ('status' in body) {
        if (!isStatus(body.status)) return res.status(400).json({ error: 'Invalid status' })
        set('status = ?', body.status)
        // Даты ставятся сами: начал смотреть — сегодня, досмотрел — сегодня (если не указано иное)
        if (body.status === 'watching' && !('started_at' in body)) sets.push('started_at = COALESCE(started_at, CURRENT_DATE)')
        if (body.status === 'completed' && !('finished_at' in body))
          sets.push('finished_at = COALESCE(finished_at, CURRENT_DATE)', 'started_at = COALESCE(started_at, CURRENT_DATE)')
      }
      if ('score' in body) {
        const score = toIntOrNull(body.score)
        if (!isValidScore(score)) return res.status(400).json({ error: 'Score must be 1–10' })
        set('score = ?::int', score)
      }
      if ('watched_episodes' in body) {
        const watched = toIntOrNull(body.watched_episodes)
        if (watched === null || !isNonNegativeInt(watched))
          return res.status(400).json({ error: 'Invalid watched_episodes' })
        // Нельзя «досмотреть» больше серий, чем есть
        set('watched_episodes = LEAST(?::int, COALESCE(episodes, 2147483647))', watched)
      }
      if ('rewatch_count' in body) {
        const n = toIntOrNull(body.rewatch_count)
        if (n === null || !isNonNegativeInt(n) || n > 999) return res.status(400).json({ error: 'Invalid rewatch_count' })
        set('rewatch_count = ?::int', n)
      }
      if ('notes' in body) {
        const notes = body.notes === null || body.notes === '' ? null : body.notes
        if (notes !== null && (typeof notes !== 'string' || notes.length > 2000))
          return res.status(400).json({ error: 'Notes must be up to 2000 characters' })
        set('notes = ?', notes)
      }
      for (const field of ['started_at', 'finished_at'] as const) {
        if (!(field in body)) continue
        const value = body[field] === '' ? null : body[field]
        if (value !== null && !isIsoDate(value)) return res.status(400).json({ error: `Invalid ${field}` })
        set(`${field} = ?::date`, value)
      }

      if (!sets.length) return res.status(400).json({ error: 'Nothing to update' })
      sets.push('updated_at = NOW()')
      params.push(req.user.id, animeId)

      const { rows } = await db.query(
        `UPDATE anime_list SET ${sets.join(', ')}
         WHERE user_id = $${params.length - 1} AND anime_id = $${params.length}
         RETURNING *`,
        params
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

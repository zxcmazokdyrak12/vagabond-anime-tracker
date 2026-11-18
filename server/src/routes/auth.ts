import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { rateLimit } from 'express-rate-limit'
import type { Db } from '../db.js'
import { asyncHandler, requireAuth, signToken, type AuthedRequest } from '../lib/auth.js'
import { EMAIL_RE } from '../lib/validation.js'

interface Deps {
  db: Db
  jwtSecret: string
  attemptsPer15Min: number
}

export function authRouter({ db, jwtSecret, attemptsPer15Min }: Deps) {
  const router = Router()

  // Защита от перебора паролей: считаются только неудачные попытки
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: attemptsPer15Min,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many attempts. Try again in 15 minutes.' },
  })

  router.post(
    '/register',
    limiter,
    asyncHandler(async (req, res) => {
      const { username, email, password } = req.body ?? {}
      if (!username || !email || !password) return res.status(400).json({ error: 'All fields required' })
      if (typeof username !== 'string' || username.trim().length < 2 || username.length > 32)
        return res.status(400).json({ error: 'Username must be 2–32 characters' })
      if (typeof email !== 'string' || !EMAIL_RE.test(email))
        return res.status(400).json({ error: 'Invalid email' })
      if (typeof password !== 'string' || password.length < 6)
        return res.status(400).json({ error: 'Password must be at least 6 characters' })

      const hash = await bcrypt.hash(password, 10)
      try {
        const { rows } = await db.query<{ id: number; username: string; email: string; is_public: boolean }>(
          'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email, is_public',
          [username.trim(), email.trim().toLowerCase(), hash]
        )
        const user = rows[0]!
        res.status(201).json({ token: signToken({ id: user.id, username: user.username }, jwtSecret), user })
      } catch (err) {
        if ((err as { code?: string }).code === '23505')
          return res.status(400).json({ error: 'Username or email already exists' })
        throw err
      }
    })
  )

  router.post(
    '/login',
    limiter,
    asyncHandler(async (req, res) => {
      const { email, password } = req.body ?? {}
      if (typeof email !== 'string' || typeof password !== 'string' || !email || !password)
        return res.status(400).json({ error: 'All fields required' })

      const { rows } = await db.query<{ id: number; username: string; email: string; password: string; is_public: boolean }>(
        'SELECT id, username, email, password, is_public FROM users WHERE email = $1',
        [email.trim().toLowerCase()]
      )
      const user = rows[0]
      // Одинаковый ответ для «нет пользователя» и «неверный пароль»
      const valid = user && (await bcrypt.compare(password, user.password))
      if (!user || !valid) return res.status(400).json({ error: 'Invalid email or password' })

      res.json({
        token: signToken({ id: user.id, username: user.username }, jwtSecret),
        user: { id: user.id, username: user.username, email: user.email, is_public: user.is_public },
      })
    })
  )

  router.get(
    '/me',
    requireAuth(jwtSecret),
    asyncHandler<AuthedRequest>(async (req, res) => {
      const { rows } = await db.query('SELECT id, username, email, is_public FROM users WHERE id = $1', [req.user.id])
      if (!rows[0]) return res.status(401).json({ error: 'User no longer exists' })
      res.json(rows[0])
    })
  )

  // Настройки аккаунта: пока только «показывать профиль всем»
  router.patch(
    '/me',
    requireAuth(jwtSecret),
    asyncHandler<AuthedRequest>(async (req, res) => {
      const { is_public } = req.body ?? {}
      if (typeof is_public !== 'boolean') return res.status(400).json({ error: 'is_public must be true or false' })
      const { rows } = await db.query(
        'UPDATE users SET is_public = $1 WHERE id = $2 RETURNING id, username, email, is_public',
        [is_public, req.user.id]
      )
      if (!rows[0]) return res.status(401).json({ error: 'User no longer exists' })
      res.json(rows[0])
    })
  )

  return router
}

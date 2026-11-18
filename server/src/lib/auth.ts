import type { NextFunction, Request, RequestHandler, Response } from 'express'
import jwt from 'jsonwebtoken'

export interface TokenPayload {
  id: number
  username: string
}

export interface AuthedRequest extends Request {
  user: TokenPayload
}

export const signToken = (payload: TokenPayload, secret: string) =>
  jwt.sign(payload, secret, { expiresIn: '7d' })

/** Проверяет Bearer-токен и кладёт пользователя в req.user */
export const requireAuth =
  (secret: string): RequestHandler =>
  (req, res, next) => {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1]
    if (!token) return void res.status(401).json({ error: 'No token' })
    try {
      const decoded = jwt.verify(token, secret)
      if (typeof decoded === 'string' || typeof decoded.id !== 'number') throw new Error('bad payload')
      ;(req as AuthedRequest).user = { id: decoded.id, username: String(decoded.username) }
      next()
    } catch {
      res.status(401).json({ error: 'Invalid token' })
    }
  }

/** Express 4 не ловит ошибки async-обработчиков — пробрасываем их в next() */
export const asyncHandler =
  <R extends Request = Request>(fn: (req: R, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req as R, res, next).catch(next)
  }

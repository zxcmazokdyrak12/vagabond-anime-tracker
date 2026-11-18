import express, { type ErrorRequestHandler } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import type { Config } from './config.js'
import type { Db } from './db.js'
import { createCachedClient } from './lib/cachedClient.js'
import { axiosHttp, UpstreamError, type Http } from './lib/http.js'
import { authRouter } from './routes/auth.js'
import { listRouter } from './routes/list.js'
import { animeRouter } from './routes/anime.js'

export interface AppDeps {
  db: Db
  config: Pick<Config, 'jwtSecret' | 'clientOrigins' | 'authAttemptsPer15Min'>
  /** Внешний HTTP; в тестах подменяется фейком */
  http?: Http
  jikanIntervalMs?: number
}

export function createApp({ db, config, http = axiosHttp, jikanIntervalMs }: AppDeps) {
  const app = express()
  const jikan = createCachedClient({ http, minIntervalMs: jikanIntervalMs })

  app.set('trust proxy', 1) // Render стоит за прокси — нужен реальный IP для rate limit
  app.disable('x-powered-by')
  app.use(helmet())
  app.use(cors(config.clientOrigins.length ? { origin: config.clientOrigins } : undefined))
  app.use(express.json({ limit: '100kb' }))

  app.get('/ping', (_req, res) => {
    res.send('ok')
  })
  app.use('/auth', authRouter({ db, jwtSecret: config.jwtSecret, attemptsPer15Min: config.authAttemptsPer15Min }))
  app.use('/api/anime', animeRouter({ jikan, http }))
  app.use('/', listRouter({ db, jwtSecret: config.jwtSecret }))

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' })
  })

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof UpstreamError) {
      // 404 источника — 404 и у нас; 429/5xx — «источник недоступен»
      const status = err.status === 404 ? 404 : err.status === 429 ? 429 : 502
      return void res.status(status).json({ error: status === 404 ? 'Anime not found' : 'Anime catalogue unavailable' })
    }
    if ((err as { type?: string }).type === 'entity.parse.failed') {
      return void res.status(400).json({ error: 'Malformed JSON' })
    }
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
  app.use(onError)

  return app
}

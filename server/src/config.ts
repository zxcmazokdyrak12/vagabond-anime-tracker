import 'dotenv/config'

export interface Config {
  databaseUrl: string
  jwtSecret: string
  port: number
  /** Фронтенды, которым разрешены запросы (CORS). Пусто — разрешены все. */
  clientOrigins: string[]
  /** Сколько попыток входа/регистрации разрешено с одного IP за 15 минут */
  authAttemptsPer15Min: number
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const missing = ['DATABASE_URL', 'JWT_SECRET'].filter((k) => !env[k])
  if (missing.length) {
    throw new Error(`Missing env: ${missing.join(', ')}. See server/.env.example`)
  }
  return {
    databaseUrl: env.DATABASE_URL!,
    jwtSecret: env.JWT_SECRET!,
    port: Number(env.PORT) || 3002,
    clientOrigins: (env.CLIENT_URL || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    authAttemptsPer15Min: Number(env.AUTH_RATE_LIMIT) || 10,
  }
}

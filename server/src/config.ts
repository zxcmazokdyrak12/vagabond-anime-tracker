import 'dotenv/config'

export interface Config {
  databaseUrl: string
  jwtSecret: string
  port: number
  /** Фронтенды, которым разрешены запросы (CORS). Пусто — разрешены все. */
  clientOrigins: string[]
  /** Сколько попыток входа/регистрации разрешено с одного IP за 15 минут */
  authAttemptsPer15Min: number
  /** Пуш-уведомления; без ключей функция просто выключена */
  push: { publicKey: string; privateKey: string; subject: string } | null
  /** Секрет, с которым планировщик (GitHub Actions) вызывает рассылку */
  cronSecret: string | null
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
    push:
      env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY
        ? {
            publicKey: env.VAPID_PUBLIC_KEY,
            privateKey: env.VAPID_PRIVATE_KEY,
            subject: env.VAPID_SUBJECT || 'mailto:noreply@vagabond-anime-tracker.dev',
          }
        : null,
    cronSecret: env.CRON_SECRET || null,
  }
}

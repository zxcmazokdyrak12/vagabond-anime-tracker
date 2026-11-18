import { Router } from 'express'
import * as webpush from 'web-push'
import type { Config } from '../config.js'
import type { Db } from '../db.js'
import { asyncHandler, requireAuth, type AuthedRequest } from '../lib/auth.js'
import type { CachedClient } from '../lib/cachedClient.js'
import { isPushEndpoint, notifyAiring, sendToUser, type SendPush } from '../lib/notifier.js'

/** Настоящая отправка через web-push (VAPID, шифрование aes128gcm) */
export function webPushSender(keys: NonNullable<Config['push']>): SendPush {
  webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey)
  return async (sub, message) => {
    try {
      const res = await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(message),
        { TTL: 6 * 60 * 60 }
      )
      return res.statusCode
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode ?? 0
      if (status !== 404 && status !== 410) console.error('Push failed:', (err as Error).message)
      return status
    }
  }
}

interface Deps {
  db: Db
  jwtSecret: string
  anilist: CachedClient
  publicKey: string | null
  cronSecret: string | null
  send: SendPush | null
  /** Как часто можно запускать рассылку (защита от спама публичного эндпоинта) */
  notifyEveryMs?: number
}

export function pushRouter({ db, jwtSecret, anilist, publicKey, cronSecret, send, notifyEveryMs = 10 * 60 * 1000 }: Deps) {
  const router = Router()
  const auth = requireAuth(jwtSecret)
  const enabled = () => Boolean(publicKey && send)

  router.get('/push/key', (_req, res) => {
    if (!enabled()) return void res.status(404).json({ error: 'Notifications are not set up on this server' })
    res.json({ key: publicKey })
  })

  router.post(
    '/push/subscribe',
    auth,
    asyncHandler<AuthedRequest>(async (req, res) => {
      if (!enabled()) return res.status(404).json({ error: 'Notifications are not set up on this server' })
      const { endpoint, keys } = req.body ?? {}
      if (!isPushEndpoint(endpoint) || typeof keys?.p256dh !== 'string' || typeof keys?.auth !== 'string')
        return res.status(400).json({ error: 'Invalid push subscription' })

      // Не больше 5 устройств: самое старое уступает место
      await db.query(
        `DELETE FROM push_subscriptions WHERE id IN (
           SELECT id FROM push_subscriptions WHERE user_id = $1 AND endpoint <> $2
           ORDER BY created_at DESC OFFSET 4)`,
        [req.user.id, endpoint]
      )
      await db.query(
        `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1, $2, $3, $4)
         ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
        [req.user.id, endpoint, keys.p256dh.slice(0, 200), keys.auth.slice(0, 100)]
      )
      res.status(201).json({ subscribed: true })
    })
  )

  router.delete(
    '/push/subscribe',
    auth,
    asyncHandler<AuthedRequest>(async (req, res) => {
      const { endpoint } = req.body ?? {}
      await db.query('DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2', [req.user.id, endpoint])
      res.json({ subscribed: false })
    })
  )

  router.post(
    '/push/test',
    auth,
    asyncHandler<AuthedRequest>(async (req, res) => {
      if (!enabled()) return res.status(404).json({ error: 'Notifications are not set up on this server' })
      const delivered = await sendToUser(db, send!, req.user.id, {
        title: 'Vagabond',
        body: 'Notifications work. New episodes of what you watch will land here.',
        url: '/?tab=calendar',
        tag: 'test',
      })
      res.json({ delivered })
    })
  )

  // Вызывается планировщиком (GitHub Actions) раз в час.
  // Секрет необязателен: без него эндпоинт публичный, но запускается не чаще раза в 10 минут,
  // а повторный запуск ничего не дублирует (notified_episodes). С CRON_SECRET — только по ключу.
  let lastRun = 0
  router.post(
    '/internal/notify-airing',
    asyncHandler(async (req, res) => {
      if (cronSecret && req.get('x-cron-secret') !== cronSecret) return res.status(403).json({ error: 'Forbidden' })
      if (!enabled()) return res.json({ aired: 0, sent: 0, disabled: true })
      const wait = lastRun + notifyEveryMs - Date.now()
      if (wait > 0) return res.status(429).json({ error: 'Already ran recently', retry_in_s: Math.ceil(wait / 1000) })
      lastRun = Date.now()
      res.json(await notifyAiring({ db, anilist, send: send! }))
    })
  )

  return router
}

import type { Db } from '../db.js'
import type { CachedClient } from './cachedClient.js'
import { ANILIST_URL } from './anilist.js'

export interface StoredSubscription {
  id: number
  user_id: number
  endpoint: string
  p256dh: string
  auth: string
}

export interface PushMessage {
  title: string
  body: string
  url: string
  icon?: string | null
  tag?: string
}

/** Отправка одного пуша. Возвращает HTTP-статус push-сервиса (404/410 — подписка мертва) */
export type SendPush = (sub: StoredSubscription, message: PushMessage) => Promise<number>

const AIRED_QUERY = `
  query ($from: Int, $to: Int, $page: Int) {
    Page(page: $page, perPage: 50) {
      pageInfo { hasNextPage }
      airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
        episode airingAt
        media { idMal title { romaji english } coverImage { medium } }
      }
    }
  }
`

interface Aired {
  episode: number
  airingAt: number
  media: { idMal: number | null; title: { romaji: string | null; english: string | null }; coverImage: { medium: string | null } }
}

/** Только настоящие push-сервисы браузеров — чтобы через подписку нельзя было заставить сервер стучаться куда угодно */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/, /^web\.push\.apple\.com$/]
export const isPushEndpoint = (url: unknown): url is string => {
  if (typeof url !== 'string' || url.length > 1000) return false
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && PUSH_HOSTS.some((re) => re.test(u.hostname))
  } catch {
    return false
  }
}

export async function sendToUser(db: Db, send: SendPush, userId: number, message: PushMessage) {
  const { rows: subs } = await db.query<StoredSubscription>('SELECT * FROM push_subscriptions WHERE user_id = $1', [userId])
  let delivered = 0
  for (const sub of subs) {
    const status = await send(sub, message)
    if (status === 404 || status === 410) {
      await db.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]) // браузер отписался
    } else if (status >= 200 && status < 300) delivered++
  }
  return delivered
}

/**
 * Рассылка: какие серии вышли за последние `windowHours` часов, и кто из
 * подписанных смотрит эти тайтлы. Каждому — один пуш на серию (notified_episodes).
 * Окно с запасом: планировщик может пропустить запуск, дубли отсекает таблица.
 */
export async function notifyAiring({
  db,
  anilist,
  send,
  now = Date.now(),
  windowHours = 3,
}: {
  db: Db
  anilist: CachedClient
  send: SendPush
  now?: number
  windowHours?: number
}) {
  const { rows: watching } = await db.query<{ user_id: number; anime_id: number; title: string }>(
    `SELECT a.user_id, a.anime_id, a.title FROM anime_list a
     WHERE a.status = 'watching' AND EXISTS (SELECT 1 FROM push_subscriptions s WHERE s.user_id = a.user_id)`
  )
  if (!watching.length) return { aired: 0, sent: 0 }

  const watchers = new Map<number, number[]>()
  for (const w of watching) watchers.set(w.anime_id, [...(watchers.get(w.anime_id) ?? []), w.user_id])

  const to = Math.floor(now / 1000)
  const from = to - windowHours * 3600
  const aired: Aired[] = []
  for (let page = 1; page <= 5; page++) {
    const res = await anilist.request<{ data: { Page: { pageInfo: { hasNextPage: boolean }; airingSchedules: Aired[] } } }>(
      `aired:${from}:${to}:${page}`,
      60 * 1000,
      () => anilist.rawPost(ANILIST_URL, { query: AIRED_QUERY, variables: { from, to, page } })
    )
    aired.push(...res.data.Page.airingSchedules)
    if (!res.data.Page.pageInfo.hasNextPage) break
  }

  let sent = 0
  for (const ep of aired) {
    const id = ep.media.idMal
    if (!id || !watchers.has(id)) continue
    for (const userId of watchers.get(id)!) {
      const fresh = await db.query(
        `INSERT INTO notified_episodes (user_id, anime_id, episode) VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING RETURNING 1`,
        [userId, id, ep.episode]
      )
      if (!fresh.rowCount) continue
      sent += await sendToUser(db, send, userId, {
        title: ep.media.title.english || ep.media.title.romaji || 'New episode',
        body: `Episode ${ep.episode} is out.`,
        url: `/anime/${id}`,
        icon: ep.media.coverImage.medium,
        tag: `ep-${id}-${ep.episode}`,
      })
    }
  }
  return { aired: aired.length, sent }
}

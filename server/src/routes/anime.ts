import { Router } from 'express'
import { asyncHandler } from '../lib/auth.js'
import type { CachedClient } from '../lib/cachedClient.js'
import type { Http } from '../lib/http.js'
import { isPositiveInt } from '../lib/validation.js'

const JIKAN = 'https://api.jikan.moe/v4'
const HOUR = 60 * 60 * 1000

interface AniListMedia {
  idMal: number | null
  title: { romaji: string | null; english: string | null; native: string | null }
  coverImage: { large: string | null }
  episodes: number | null
  averageScore: number | null
}

const SEARCH_QUERY = `
  query ($search: String) {
    Page(perPage: 12) {
      media(search: $search, type: ANIME, isAdult: false) {
        idMal
        title { romaji english native }
        coverImage { large }
        episodes
        averageScore
      }
    }
  }
`

/**
 * Все запросы к каталогам аниме идут через сервер: так работает кеш,
 * очередь под лимиты Jikan и никакие внешние API не дёргаются из браузера.
 */
export function animeRouter({ jikan, http }: { jikan: CachedClient; http: Http }) {
  const router = Router()
  const searchCache = new Map<string, { data: unknown; expires: number }>()

  // Поиск: AniList (быстрый, без жёстких лимитов) → запасной Jikan
  router.get(
    '/search',
    asyncHandler(async (req, res) => {
      const q = String(req.query.q ?? '').trim().slice(0, 100)
      if (!q) return res.json({ data: [] })

      const key = q.toLowerCase()
      const hit = searchCache.get(key)
      if (hit && hit.expires > Date.now()) return res.json(hit.data)

      let payload: unknown
      try {
        const r = await http.post('https://graphql.anilist.co', { query: SEARCH_QUERY, variables: { search: q } })
        if (r.status !== 200) throw new Error(`AniList ${r.status}`)
        const media = (r.data as { data: { Page: { media: AniListMedia[] } } }).data.Page.media
        // Берём MAL id (idMal), а не id AniList: страница тайтла и список работают на MAL id
        payload = {
          data: media
            .filter((m) => m.idMal)
            .map((m) => ({
              mal_id: m.idMal,
              title: m.title.romaji || m.title.english || m.title.native,
              title_english: m.title.english,
              images: { jpg: { image_url: m.coverImage.large } },
              episodes: m.episodes,
              score: m.averageScore ? m.averageScore / 10 : null,
            })),
        }
      } catch (err) {
        console.error('AniList search failed, falling back to Jikan:', (err as Error).message)
        payload = await jikan.get(`${JIKAN}/anime?q=${encodeURIComponent(q)}&limit=12&sfw=true`, 10 * 60 * 1000)
      }

      searchCache.set(key, { data: payload, expires: Date.now() + 10 * 60 * 1000 })
      if (searchCache.size > 300) searchCache.delete(searchCache.keys().next().value!)
      res.json(payload)
    })
  )

  router.get(
    '/top',
    asyncHandler(async (_req, res) => {
      res.json(await jikan.get(`${JIKAN}/top/anime?limit=10`, 6 * HOUR))
    })
  )

  router.get(
    '/season',
    asyncHandler(async (_req, res) => {
      res.json(await jikan.get(`${JIKAN}/seasons/now?limit=12&sfw=true`, 3 * HOUR))
    })
  )

  // /api/anime/:id, /api/anime/:id/characters, /api/anime/:id/episodes
  const SUBRESOURCES: Record<string, { path: string; ttl: number }> = {
    '': { path: 'full', ttl: 12 * HOUR },
    characters: { path: 'characters', ttl: 24 * HOUR },
    episodes: { path: 'episodes', ttl: 6 * HOUR },
  }

  router.get(
    '/:id/:sub?',
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id)
      const sub = SUBRESOURCES[req.params.sub ?? '']
      // id подставляется в URL внешнего API — пропускаем только числа
      if (!isPositiveInt(id) || !sub) return res.status(400).json({ error: 'Invalid anime id' })
      res.json(await jikan.get(`${JIKAN}/anime/${id}/${sub.path}`, sub.ttl))
    })
  )

  return router
}

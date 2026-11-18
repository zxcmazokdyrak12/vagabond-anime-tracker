import { Router } from 'express'
import { asyncHandler } from '../lib/auth.js'
import type { CachedClient } from '../lib/cachedClient.js'
import { UpstreamError } from '../lib/http.js'
import { isPositiveInt } from '../lib/validation.js'
import {
  ANILIST_URL, DETAIL_QUERY, SEASON_QUERY, TOP_QUERY, currentSeason, toAnime, toCharacters, toEpisodes, unwrap,
  type AniMedia,
} from '../lib/anilist.js'

const JIKAN = process.env.JIKAN_URL || 'https://api.jikan.moe/v4'
const MIN = 60 * 1000
const HOUR = 60 * MIN

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

interface SearchMedia {
  idMal: number | null
  title: { romaji: string | null; english: string | null; native: string | null }
  coverImage: { large: string | null }
  episodes: number | null
  averageScore: number | null
}

type Page = { Page: { media: AniMedia[] } }

/** Сначала основной источник; если он лежит (не 404) — запасной */
async function withFallback<T>(primary: () => Promise<T>, fallback: () => Promise<T>, label: string): Promise<T> {
  try {
    return await primary()
  } catch (err) {
    if (err instanceof UpstreamError && err.status === 404) throw err
    console.error(`${label}: AniList failed (${(err as Error).message}), trying Jikan`)
    return fallback()
  }
}

/**
 * Каталог аниме. Основной источник — AniList: Jikan с серверов Render
 * недоступен (соединение обрывается по таймауту), поэтому он только запасной.
 * Всё кешируется и идёт через очередь, браузер внешние API не дёргает.
 */
export function animeRouter({ anilist, jikan }: { anilist: CachedClient; jikan: CachedClient }) {
  const router = Router()

  router.get(
    '/search',
    asyncHandler(async (req, res) => {
      const q = String(req.query.q ?? '').trim().slice(0, 100)
      if (!q) return res.json({ data: [] })

      const payload = await withFallback(
        async () => {
          const data = unwrap<{ Page: { media: SearchMedia[] } }>(
            await anilist.post(ANILIST_URL, { query: SEARCH_QUERY, variables: { search: q.toLowerCase() } }, 10 * MIN)
          )
          // Берём MAL id (idMal), а не id AniList: страница тайтла и список работают на MAL id
          return {
            data: data.Page.media
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
        },
        () => jikan.get(`${JIKAN}/anime?q=${encodeURIComponent(q)}&limit=12&sfw=true`, 10 * MIN),
        'search'
      )
      res.json(payload)
    })
  )

  router.get(
    '/top',
    asyncHandler(async (_req, res) => {
      const payload = await withFallback(
        async () => {
          const data = unwrap<Page>(await anilist.post(ANILIST_URL, { query: TOP_QUERY }, 6 * HOUR))
          const media = data.Page.media.filter((m) => m.idMal).slice(0, 10)
          // rank — место в нашем топе, а не в общем рейтинге AniList
          return { data: media.map((m, i) => ({ ...toAnime(m), rank: i + 1 })) }
        },
        () => jikan.get(`${JIKAN}/top/anime?limit=10`, 6 * HOUR),
        'top'
      )
      res.json(payload)
    })
  )

  router.get(
    '/season',
    asyncHandler(async (_req, res) => {
      const payload = await withFallback(
        async () => {
          const variables = currentSeason()
          const data = unwrap<Page>(await anilist.post(ANILIST_URL, { query: SEASON_QUERY, variables }, 3 * HOUR))
          return { data: data.Page.media.filter((m) => m.idMal).slice(0, 12).map(toAnime) }
        },
        () => jikan.get(`${JIKAN}/seasons/now?limit=12&sfw=true`, 3 * HOUR),
        'season'
      )
      res.json(payload)
    })
  )

  // /api/anime/:id, /:id/characters, /:id/episodes — один запрос к AniList на всё, дальше из кеша
  const SUBRESOURCES = {
    '': { jikan: 'full', map: (m: AniMedia) => toAnime(m) },
    characters: { jikan: 'characters', map: toCharacters },
    episodes: { jikan: 'episodes', map: toEpisodes },
  } as const

  router.get(
    '/:id/:sub?',
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id)
      const sub = SUBRESOURCES[(req.params.sub ?? '') as keyof typeof SUBRESOURCES]
      // id подставляется в URL внешнего API — пропускаем только числа
      if (!isPositiveInt(id) || !sub) return res.status(400).json({ error: 'Invalid anime id' })

      const payload = await withFallback(
        async () => {
          const data = unwrap<{ Media: AniMedia }>(
            await anilist.post(ANILIST_URL, { query: DETAIL_QUERY, variables: { idMal: id } }, 12 * HOUR)
          )
          return { data: sub.map(data.Media) }
        },
        () => jikan.get(`${JIKAN}/anime/${id}/${sub.jikan}`, 12 * HOUR),
        `anime ${id}`
      )
      res.json(payload)
    })
  )

  return router
}

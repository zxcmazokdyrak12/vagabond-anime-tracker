import { Router } from 'express'
import type { Db } from '../db.js'
import { asyncHandler, requireAuth, type AuthedRequest } from '../lib/auth.js'
import type { CachedClient } from '../lib/cachedClient.js'
import { ANILIST_URL } from '../lib/anilist.js'

const MIN = 60 * 1000
const DAY_S = 24 * 60 * 60

const AIRING_QUERY = `
  query ($ids: [Int]) {
    Page(perPage: 50) {
      media(idMal_in: $ids, type: ANIME, status: RELEASING) {
        idMal
        title { romaji english }
        coverImage { large }
        episodes
        airingSchedule(notYetAired: true, perPage: 4) { nodes { episode airingAt } }
      }
    }
  }
`

const RECS_QUERY = `
  query ($ids: [Int]) {
    Page(perPage: 10) {
      media(idMal_in: $ids, type: ANIME) {
        idMal
        title { romaji english }
        recommendations(sort: RATING_DESC, perPage: 10) {
          nodes {
            rating
            mediaRecommendation {
              idMal isAdult format episodes averageScore
              title { romaji english }
              coverImage { large }
            }
          }
        }
      }
    }
  }
`

interface AiringMedia {
  idMal: number
  title: { romaji: string | null; english: string | null }
  coverImage: { large: string | null }
  episodes: number | null
  airingSchedule: { nodes: { episode: number; airingAt: number }[] }
}

interface RecMedia {
  idMal: number
  title: { romaji: string | null; english: string | null }
  recommendations: {
    nodes: {
      rating: number
      mediaRecommendation: {
        idMal: number | null
        isAdult: boolean
        format: string | null
        episodes: number | null
        averageScore: number | null
        title: { romaji: string | null; english: string | null }
        coverImage: { large: string | null }
      } | null
    }[]
  }
}

const chunks = <T>(arr: T[], size: number) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size))

export function discoverRouter({ db, jwtSecret, anilist }: { db: Db; jwtSecret: string; anilist: CachedClient }) {
  const router = Router()
  const auth = requireAuth(jwtSecret)

  // Календарь: серии из «смотрю» и «в планах», которые выйдут в ближайшие 7 дней
  router.get(
    '/calendar',
    auth,
    asyncHandler<AuthedRequest>(async (req, res) => {
      const { rows } = await db.query<{ anime_id: number; status: string; watched_episodes: number }>(
        `SELECT anime_id, status, watched_episodes FROM anime_list
         WHERE user_id = $1 AND status IN ('watching', 'planning')`,
        [req.user.id]
      )
      const mine = new Map(rows.map((r) => [r.anime_id, r]))
      const ids = [...mine.keys()].sort((a, b) => a - b)
      const now = Math.floor(Date.now() / 1000)

      const episodes = []
      for (const chunk of chunks(ids, 50)) {
        const data = await anilist.post<{ data: { Page: { media: AiringMedia[] } } }>(
          ANILIST_URL,
          { query: AIRING_QUERY, variables: { ids: chunk } },
          30 * MIN
        )
        for (const m of data.data.Page.media) {
          for (const ep of m.airingSchedule.nodes) {
            if (ep.airingAt < now - 6 * 60 * 60 || ep.airingAt > now + 7 * DAY_S) continue
            episodes.push({
              anime_id: m.idMal,
              title: m.title.romaji || m.title.english,
              title_english: m.title.english,
              image: m.coverImage.large,
              episode: ep.episode,
              episodes: m.episodes,
              airing_at: new Date(ep.airingAt * 1000).toISOString(),
              status: mine.get(m.idMal)?.status,
              watched_episodes: mine.get(m.idMal)?.watched_episodes ?? 0,
            })
          }
        }
      }
      episodes.sort((a, b) => a.airing_at.localeCompare(b.airing_at))
      res.json({ data: episodes })
    })
  )

  // Рекомендации: что советуют любители тайтлов, которые ты оценил выше всего
  router.get(
    '/recommendations',
    auth,
    asyncHandler<AuthedRequest>(async (req, res) => {
      const { rows: list } = await db.query<{ anime_id: number; title: string; score: number | null; status: string }>(
        'SELECT anime_id, title, score, status FROM anime_list WHERE user_id = $1',
        [req.user.id]
      )
      const seeds = list
        .filter((e) => (e.score ?? 0) >= 8 || (e.score === null && e.status === 'completed'))
        .sort((a, b) => (b.score ?? 7) - (a.score ?? 7))
        .slice(0, 6)
      if (!seeds.length) return res.json({ data: [], seeds: [] })

      const data = await anilist.post<{ data: { Page: { media: RecMedia[] } } }>(
        ANILIST_URL,
        { query: RECS_QUERY, variables: { ids: seeds.map((s) => s.anime_id).sort((a, b) => a - b) } },
        6 * 60 * MIN
      )

      const owned = new Set(list.map((e) => e.anime_id))
      const picks = new Map<number, { weight: number; because: string[]; anime: Record<string, unknown> }>()
      for (const seed of data.data.Page.media) {
        const seedTitle = seed.title.english || seed.title.romaji || ''
        for (const node of seed.recommendations.nodes) {
          const rec = node.mediaRecommendation
          if (!rec?.idMal || rec.isAdult || owned.has(rec.idMal) || node.rating <= 0) continue
          const pick = picks.get(rec.idMal) ?? {
            weight: 0,
            because: [],
            anime: {
              mal_id: rec.idMal,
              title: rec.title.romaji || rec.title.english,
              title_english: rec.title.english,
              images: { jpg: { image_url: rec.coverImage.large } },
              episodes: rec.episodes,
              score: rec.averageScore ? rec.averageScore / 10 : null,
              type: rec.format,
            },
          }
          // Тайтл, который советуют к нескольким твоим любимым, поднимается выше
          pick.weight += Math.log2(1 + node.rating)
          if (!pick.because.includes(seedTitle)) pick.because.push(seedTitle)
          picks.set(rec.idMal, pick)
        }
      }

      const top = [...picks.values()].sort((a, b) => b.weight - a.weight).slice(0, 12)
      res.json({
        data: top.map((p) => ({ ...p.anime, because: p.because.slice(0, 2) })),
        seeds: seeds.map((s) => s.title),
      })
    })
  )

  return router
}

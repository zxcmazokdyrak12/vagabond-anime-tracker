import type { Db } from '../db.js'
import type { CachedClient } from './cachedClient.js'
import { ANILIST_URL } from './anilist.js'

const POSTERS_QUERY = `
  query ($ids: [Int]) {
    Page(perPage: 50) { media(idMal_in: $ids, type: ANIME) { idMal coverImage { large } episodes } }
  }
`

/**
 * В выгрузках MAL/Шикимори нет картинок — дотягиваем постеры (и число серий,
 * если его не было) из AniList пачками по 50.
 */
export async function fillPosters(db: Db, anilist: CachedClient, userId: number, ids: number[]) {
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50)
    try {
      const res = await anilist.post<{ data: { Page: { media: { idMal: number; coverImage: { large: string | null }; episodes: number | null }[] } } }>(
        ANILIST_URL,
        { query: POSTERS_QUERY, variables: { ids: chunk } },
        24 * 60 * 60 * 1000
      )
      const media = res.data.Page.media.filter((m) => m.idMal)
      if (!media.length) continue
      await db.query(
        `UPDATE anime_list a
         SET image = COALESCE(a.image, m.image),
             episodes = COALESCE(a.episodes, m.episodes)
         FROM unnest($2::int[], $3::text[], $4::int[]) AS m(anime_id, image, episodes)
         WHERE a.user_id = $1 AND a.anime_id = m.anime_id`,
        [userId, media.map((m) => m.idMal), media.map((m) => m.coverImage.large), media.map((m) => m.episodes)]
      )
    } catch (err) {
      console.error('Poster fill failed:', (err as Error).message)
    }
  }
}

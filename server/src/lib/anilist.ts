/**
 * AniList GraphQL → формат Jikan/MyAnimeList, который понимает фронтенд.
 * Ключ — MAL id (idMal): им пользуется весь трекер, включая сохранённые свитки.
 */

/** Адрес можно подменить для E2E-тестов (там поднимается мок каталога) */
export const ANILIST_URL = process.env.ANILIST_URL || 'https://graphql.anilist.co'

const MEDIA_FIELDS = `
  id idMal
  title { romaji english native }
  coverImage { large extraLarge }
  description(asHtml: false)
  episodes duration averageScore popularity seasonYear format status source genres
  studios(isMain: true) { nodes { name } }
  rankings { rank type allTime }
  trailer { id site }
  startDate { year month day }
  endDate { year month day }
  nextAiringEpisode { episode airingAt }
`

export const TOP_QUERY = `
  query { Page(perPage: 15) { media(type: ANIME, sort: SCORE_DESC, isAdult: false) { ${MEDIA_FIELDS} } } }
`

export const SEASON_QUERY = `
  query ($season: MediaSeason, $year: Int) {
    Page(perPage: 18) {
      media(type: ANIME, season: $season, seasonYear: $year, sort: POPULARITY_DESC, isAdult: false) { ${MEDIA_FIELDS} }
    }
  }
`

export const DETAIL_QUERY = `
  query ($idMal: Int) {
    Media(idMal: $idMal, type: ANIME) {
      ${MEDIA_FIELDS}
      characters(perPage: 12, sort: [ROLE, RELEVANCE]) {
        edges { role node { id name { full } image { medium } } voiceActors(language: JAPANESE) { name { full } } }
      }
      streamingEpisodes { title }
      airingSchedule(notYetAired: false, perPage: 50) { nodes { episode airingAt } }
    }
  }
`

type Fuzzy = { year: number | null; month: number | null; day: number | null } | null

export interface AniMedia {
  id: number
  idMal: number | null
  title: { romaji: string | null; english: string | null; native: string | null }
  coverImage: { large: string | null; extraLarge: string | null }
  description: string | null
  episodes: number | null
  duration: number | null
  averageScore: number | null
  popularity: number | null
  seasonYear: number | null
  format: string | null
  status: string | null
  source: string | null
  genres: string[] | null
  studios: { nodes: { name: string }[] } | null
  rankings: { rank: number; type: string; allTime: boolean }[] | null
  trailer: { id: string; site: string } | null
  startDate: Fuzzy
  endDate: Fuzzy
  nextAiringEpisode: { episode: number; airingAt: number } | null
  characters?: {
    edges: {
      role: string
      node: { id: number; name: { full: string }; image: { medium: string | null } }
      voiceActors: { name: { full: string } }[]
    }[]
  }
  streamingEpisodes?: { title: string }[]
  airingSchedule?: { nodes: { episode: number; airingAt: number }[] }
}

const FORMATS: Record<string, string> = {
  TV: 'TV', TV_SHORT: 'TV Short', MOVIE: 'Movie', SPECIAL: 'Special', OVA: 'OVA', ONA: 'ONA', MUSIC: 'Music',
}
const STATUSES: Record<string, string> = {
  RELEASING: 'Currently Airing',
  FINISHED: 'Finished Airing',
  NOT_YET_RELEASED: 'Not yet aired',
  CANCELLED: 'Cancelled',
  HIATUS: 'On hiatus',
}

const titleCase = (s: string) => s.toLowerCase().replace(/(^|_)(\w)/g, (_m, sep, c: string) => (sep ? ' ' : '') + c.toUpperCase())

/** Описание AniList приходит с <br>, <i> и HTML-сущностями */
export const cleanDescription = (html: string | null) =>
  html
    ? html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&#039;|&apos;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    : null

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const fuzzyToText = (d: Fuzzy) =>
  d?.year ? [d.day, d.month ? MONTHS[d.month - 1] : null, d.year].filter(Boolean).join(' ') : null

/** Текущий сезон в терминах AniList */
export function currentSeason(now = new Date()) {
  const m = now.getUTCMonth() // 0–11
  const season = m <= 2 ? 'WINTER' : m <= 5 ? 'SPRING' : m <= 8 ? 'SUMMER' : 'FALL'
  return { season, year: now.getUTCFullYear() }
}

/** Карточка тайтла в формате Jikan */
export function toAnime(m: AniMedia) {
  const rated = m.rankings?.find((r) => r.type === 'RATED' && r.allTime)
  const start = fuzzyToText(m.startDate)
  const end = fuzzyToText(m.endDate)
  return {
    mal_id: m.idMal,
    anilist_id: m.id,
    title: m.title.romaji || m.title.english || m.title.native || 'Untitled',
    title_english: m.title.english,
    title_japanese: m.title.native,
    images: { jpg: { image_url: m.coverImage.large, large_image_url: m.coverImage.extraLarge || m.coverImage.large } },
    synopsis: cleanDescription(m.description),
    episodes: m.episodes,
    score: m.averageScore ? Math.round(m.averageScore) / 10 : null,
    rank: rated?.rank ?? null,
    year: m.seasonYear ?? m.startDate?.year ?? null,
    type: m.format ? (FORMATS[m.format] ?? m.format) : null,
    status: m.status ? (STATUSES[m.status] ?? m.status) : null,
    airing: m.status === 'RELEASING',
    genres: (m.genres ?? []).map((name, i) => ({ mal_id: i, name })),
    studios: m.studios?.nodes ?? [],
    source: m.source ? titleCase(m.source) : null,
    duration: m.duration ? `${m.duration} min per ep` : null,
    members: m.popularity,
    aired: { string: start ? (end && end !== start ? `${start} to ${end}` : start) : null },
    trailer: {
      embed_url: m.trailer?.site === 'youtube' ? `https://www.youtube-nocookie.com/embed/${m.trailer.id}` : null,
    },
    next_airing: m.nextAiringEpisode
      ? { episode: m.nextAiringEpisode.episode, at: new Date(m.nextAiringEpisode.airingAt * 1000).toISOString() }
      : null,
  }
}

export function toCharacters(m: AniMedia) {
  return (m.characters?.edges ?? []).map((e) => ({
    character: { mal_id: e.node.id, name: e.node.name.full, images: { jpg: { image_url: e.node.image.medium } } },
    role: titleCase(e.role),
    voice_actors: e.voiceActors.slice(0, 1).map((va) => ({ person: { name: va.name.full } })),
  }))
}

/**
 * Список серий: названия из streamingEpisodes («Episode 3 - Killing Magic»),
 * даты выхода — из airingSchedule. Что есть, то и показываем.
 */
export function toEpisodes(m: AniMedia) {
  const aired = new Map((m.airingSchedule?.nodes ?? []).map((n) => [n.episode, new Date(n.airingAt * 1000).toISOString()]))
  const titled = new Map<number, string>()
  for (const ep of m.streamingEpisodes ?? []) {
    const match = ep.title.match(/^Episode\s+(\d+)\s*[-–:]\s*(.+)$/i)
    if (match) titled.set(Number(match[1]), match[2]!.trim())
  }
  const numbers = [...new Set([...titled.keys(), ...aired.keys()])].sort((a, b) => a - b)
  return numbers.map((n) => ({ mal_id: n, title: titled.get(n) ?? `Episode ${n}`, aired: aired.get(n) ?? null }))
}

/** Ответ GraphQL: 404 у AniList приходит статусом, прочие ошибки — массивом errors */
export function unwrap<T>(payload: unknown): T {
  return (payload as { data: T }).data
}

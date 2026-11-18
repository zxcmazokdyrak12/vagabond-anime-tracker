// ── Наш API ─────────────────────────────────────────────
export type Status = 'watching' | 'completed' | 'planning' | 'dropped'

export interface User {
  id: number
  username: string
  email: string
}

export interface AuthResponse {
  token: string
  user: User
}

/** Строка из таблицы anime_list */
export interface ListEntry {
  id: number
  user_id: number
  anime_id: number
  title: string
  image: string | null
  episodes: number | null
  status: Status
  score: number | null
  watched_episodes: number
  created_at: string
  updated_at?: string
  /** «2026-11-18» */
  started_at?: string | null
  finished_at?: string | null
  notes?: string | null
  rewatch_count?: number
}

export type ListPatch = Partial<
  Pick<ListEntry, 'status' | 'score' | 'watched_episodes' | 'started_at' | 'finished_at' | 'notes' | 'rewatch_count'>
>

export interface NewListEntry {
  anime_id: number
  title: string
  image?: string | null
  episodes?: number | null
  status?: Status
}

export interface Stats extends Record<Status, number> {
  avg_score: number
  total_episodes: number
}

// ── Каталог (формат Jikan / MyAnimeList; поиск через AniList приводится к нему же) ──
export interface Anime {
  mal_id: number
  title: string
  title_english?: string | null
  title_japanese?: string | null
  images?: { jpg?: { image_url?: string | null; large_image_url?: string | null } }
  synopsis?: string | null
  episodes?: number | null
  score?: number | null
  rank?: number | null
  year?: number | null
  type?: string | null
  status?: string | null
  airing?: boolean
  genres?: { mal_id: number; name: string }[]
  studios?: { name: string }[]
  source?: string | null
  duration?: string | null
  rating?: string | null
  members?: number | null
  aired?: { string?: string | null }
  trailer?: { embed_url?: string | null }
  theme?: { openings?: string[]; endings?: string[] }
  /** Следующая серия онгоинга (AniList) */
  next_airing?: { episode: number; at: string } | null
}

export interface Character {
  character: { mal_id: number; name: string; images?: { jpg?: { image_url?: string | null } } }
  role: string
  voice_actors?: { person: { name: string } }[]
}

export interface Episode {
  mal_id: number
  title: string
  aired?: string | null
}

export interface Paged<T> {
  data: T[]
}

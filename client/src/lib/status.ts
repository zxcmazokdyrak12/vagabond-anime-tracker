import type { Anime, Status } from '../types'

// Состояния свитка: иероглиф и подпись
export const STATUSES: Record<Status, { glyph: string; label: string }> = {
  watching: { glyph: '観', label: 'Watching' },
  completed: { glyph: '完', label: 'Completed' },
  planning: { glyph: '計', label: 'Planning' },
  dropped: { glyph: '棄', label: 'Dropped' },
}

export const STATUS_KEYS = Object.keys(STATUSES) as Status[]

/** Картинка тайтла из ответа каталога (Jikan или AniList) */
export const posterOf = (anime: Pick<Anime, 'images'> | undefined, large = false): string | undefined =>
  (large ? anime?.images?.jpg?.large_image_url : null) || anime?.images?.jpg?.image_url || undefined

/** «1 episode», «12 episodes» */
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

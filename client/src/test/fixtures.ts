import type { ListEntry, Stats } from '../types'

export const entry = (over: Partial<ListEntry> = {}): ListEntry => ({
  id: 1,
  user_id: 1,
  anime_id: 52991,
  title: 'Sousou no Frieren',
  image: null,
  episodes: 28,
  status: 'watching',
  score: null,
  watched_episodes: 17,
  created_at: '2026-11-01T00:00:00Z',
  ...over,
})

export const stats = (over: Partial<Stats> = {}): Stats => ({
  watching: 2,
  completed: 3,
  planning: 1,
  dropped: 1,
  avg_score: 8.4,
  total_episodes: 120,
  ...over,
})

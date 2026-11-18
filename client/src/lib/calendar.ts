import type { CalendarEpisode } from '../types'

/** Ключ дня в местном времени: 2026-11-18 */
export const dayKey = (d: Date) => d.toLocaleDateString('en-CA')

/** Серии по дням, в порядке выхода */
export function groupByDay(episodes: CalendarEpisode[]) {
  const groups = new Map<string, CalendarEpisode[]>()
  for (const ep of episodes) {
    const key = dayKey(new Date(ep.airing_at))
    groups.set(key, [...(groups.get(key) ?? []), ep])
  }
  return [...groups.entries()]
}

import type { ListEntry } from '../types'

export type SortKey = 'added' | 'updated' | 'title' | 'score' | 'progress'

export const SORTS: { id: SortKey; label: string }[] = [
  { id: 'added', label: 'Recently added' },
  { id: 'updated', label: 'Recently updated' },
  { id: 'title', label: 'Title' },
  { id: 'score', label: 'Score' },
  { id: 'progress', label: 'Progress' },
]

const progressOf = (e: ListEntry) => (e.episodes ? (e.watched_episodes || 0) / e.episodes : 0)

export function sortEntries(list: ListEntry[], key: SortKey): ListEntry[] {
  const out = [...list]
  switch (key) {
    case 'title':
      return out.sort((a, b) => a.title.localeCompare(b.title))
    case 'score':
      // Без оценки — в конец
      return out.sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    case 'progress':
      return out.sort((a, b) => progressOf(b) - progressOf(a))
    case 'updated':
      return out.sort((a, b) => (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at))
    default:
      return out // сервер уже отдаёт по дате добавления
  }
}

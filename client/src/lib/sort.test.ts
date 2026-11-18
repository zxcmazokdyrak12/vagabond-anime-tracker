import { sortEntries } from './sort'
import { entry } from '../test/fixtures'

const list = [
  entry({ anime_id: 1, title: 'Bebop', score: 8, watched_episodes: 26, episodes: 26, updated_at: '2026-11-01T00:00:00Z' }),
  entry({ anime_id: 2, title: 'Akira', score: null, watched_episodes: 0, episodes: 1, updated_at: '2026-11-10T00:00:00Z' }),
  entry({ anime_id: 3, title: 'Monster', score: 10, watched_episodes: 37, episodes: 74, updated_at: '2026-11-05T00:00:00Z' }),
]
const ids = (l: typeof list) => l.map((e) => e.anime_id)

describe('sortEntries', () => {
  it('keeps the server order for recently added', () => expect(ids(sortEntries(list, 'added'))).toEqual([1, 2, 3]))
  it('sorts by title', () => expect(ids(sortEntries(list, 'title'))).toEqual([2, 1, 3]))
  it('puts unscored titles last', () => expect(ids(sortEntries(list, 'score'))).toEqual([3, 1, 2]))
  it('sorts by progress', () => expect(ids(sortEntries(list, 'progress'))).toEqual([1, 3, 2]))
  it('sorts by last update', () => expect(ids(sortEntries(list, 'updated'))).toEqual([2, 3, 1]))
  it('does not mutate the input', () => {
    sortEntries(list, 'title')
    expect(ids(list)).toEqual([1, 2, 3])
  })
})

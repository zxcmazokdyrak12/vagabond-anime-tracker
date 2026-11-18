import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CalendarView from './CalendarView'
import { groupByDay } from '../../lib/calendar'
import type { CalendarEpisode } from '../../types'

// Через час, но не позже конца сегодняшнего дня: иначе после 23:00 эпизод уезжает на «завтра»
function laterToday() {
  const end = new Date()
  end.setHours(23, 59, 0, 0)
  return new Date(Math.min(Date.now() + 3_600_000, Math.max(Date.now() + 1000, end.getTime()))).toISOString()
}

const ep = (over: Partial<CalendarEpisode>): CalendarEpisode => ({
  anime_id: 52991,
  title: 'Sousou no Frieren',
  title_english: 'Frieren',
  image: null,
  episode: 8,
  episodes: 28,
  airing_at: laterToday(),
  status: 'watching',
  watched_episodes: 5,
  ...over,
})

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString()

describe('CalendarView', () => {
  it('groups episodes by local day in airing order', () => {
    const groups = groupByDay([ep({ airing_at: inDays(0) }), ep({ anime_id: 1, airing_at: inDays(0) }), ep({ airing_at: inDays(2) })])
    expect(groups.map(([, eps]) => eps.length)).toEqual([2, 1])
  })

  it('shows today with how far behind you are', () => {
    render(
      <MemoryRouter>
        <CalendarView calendar={{ status: 'done', episodes: [ep({})] }} onRetry={() => {}} />
      </MemoryRouter>
    )
    const today = screen.getByText('Today').closest('li')!
    expect(within(today).getByRole('link', { name: 'Frieren' })).toHaveAttribute('href', '/anime/52991')
    expect(within(today).getByText(/Episode 8 of 28. You’re 2 behind/)).toBeInTheDocument()
  })

  it('invites to add ongoing anime when the week is empty', () => {
    render(
      <MemoryRouter>
        <CalendarView calendar={{ status: 'done', episodes: [] }} onRetry={() => {}} />
      </MemoryRouter>
    )
    expect(screen.getByRole('heading', { name: 'Nothing airs this week' })).toBeInTheDocument()
  })
})

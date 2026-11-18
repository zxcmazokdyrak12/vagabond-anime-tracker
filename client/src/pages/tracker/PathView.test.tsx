import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PathView from './PathView'
import { stats } from '../../test/fixtures'

const renderPath = (s: Parameters<typeof PathView>[0]['stats']) =>
  render(
    <MemoryRouter>
      <PathView stats={s} />
    </MemoryRouter>
  )

describe('PathView', () => {
  it('shows counts, the status bar and hours watched', () => {
    renderPath(stats({ total_episodes: 120, avg_score: 8.4 }))
    expect(screen.getByText('7 titles in your scrolls')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Watching: 2, Completed: 3, Planning: 1, Dropped: 1' })).toBeInTheDocument()
    // 120 серий × 24 минуты = 48 часов
    expect(screen.getByText(/roughly 48 hours/)).toBeInTheDocument()
    expect(screen.getByText('8.4')).toBeInTheDocument()
  })

  it('nudges to score titles when there is no average yet', () => {
    renderPath(stats({ avg_score: 0 }))
    expect(screen.getByText(/Score a few titles/)).toBeInTheDocument()
  })

  it('has an empty state for a new account', () => {
    renderPath(stats({ watching: 0, completed: 0, planning: 0, dropped: 0, total_episodes: 0 }))
    expect(screen.getByRole('heading', { name: 'Your path starts with one title' })).toBeInTheDocument()
  })

  it('shows a loader before stats arrive', () => {
    renderPath(null)
    expect(screen.getByRole('status')).toHaveTextContent('Tracing your path')
  })
})

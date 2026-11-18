import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PublicProfilePage from './PublicProfilePage'
import * as api from '../api'
import { stats } from '../test/fixtures'

vi.mock('../api', async (orig) => ({ ...(await orig<typeof import('../api')>()), getPublicProfile: vi.fn() }))
const mocked = vi.mocked(api)

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/u/:username" element={<PublicProfilePage signedIn={false} />} />
      </Routes>
    </MemoryRouter>
  )

describe('PublicProfilePage', () => {
  it('shows someone’s path grouped by status', async () => {
    mocked.getPublicProfile.mockResolvedValue({
      data: {
        username: 'musashi',
        member_since: '2026-09-01T00:00:00Z',
        stats: stats(),
        list: [
          { anime_id: 1, title: 'Bebop', image: null, episodes: 26, status: 'completed', score: 9, watched_episodes: 26, finished_at: null, rewatch_count: 0 },
          { anime_id: 2, title: 'Frieren', image: null, episodes: 28, status: 'watching', score: null, watched_episodes: 5, finished_at: null, rewatch_count: 0 },
        ],
      },
    } as never)
    renderAt('/u/musashi')

    expect(await screen.findByRole('heading', { name: 'musashi' })).toBeInTheDocument()
    expect(screen.getByText(/musashi has watched/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Completed/ })).toHaveTextContent('1 title')
    expect(screen.getByText('Scored 9, 26/26 ep.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start your own path' })).toHaveAttribute('href', '/')
  })

  it('does not reveal whether a private profile exists', async () => {
    mocked.getPublicProfile.mockRejectedValue(
      Object.assign(new Error('404'), { isAxiosError: true, response: { status: 404 } })
    )
    renderAt('/u/ghost')
    expect(await screen.findByText('This path is private or does not exist')).toBeInTheDocument()
  })
})

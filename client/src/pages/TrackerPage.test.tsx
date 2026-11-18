import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import TrackerPage from './TrackerPage'
import * as api from '../api'
import { entry, stats } from '../test/fixtures'

vi.mock('../api')
const mocked = vi.mocked(api)
const ok = <T,>(data: T) => Promise.resolve({ data } as Awaited<ReturnType<typeof api.getList>> & { data: T })

const user = { id: 1, username: 'musashi', email: 'm@v.jp' }

function renderAt(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <TrackerPage user={user} onLogout={() => {}} onUserChange={() => {}} />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  mocked.getStats.mockReturnValue(ok(stats()))
  mocked.errorStatus.mockImplementation(() => 'network')
})

describe('TrackerPage', () => {
  it('marks a title completed when the last episode is watched', async () => {
    mocked.getList.mockReturnValue(ok([entry({ title: 'Almost done', episodes: 12, watched_episodes: 11 })]))
    mocked.updateAnime.mockImplementation((id, patch) => ok(entry({ anime_id: id, episodes: 12, ...patch })))
    renderAt('/?tab=scrolls')

    await userEvent.click(await screen.findByRole('button', { name: /Mark next episode of Almost done/ }))

    expect(mocked.updateAnime).toHaveBeenCalledWith(52991, { watched_episodes: 12, status: 'completed' })
    await waitFor(() => expect(screen.getByText('12 of 12 episodes')).toBeInTheDocument())
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveValue('completed')
  })

  it('rolls back an optimistic update when the server refuses', async () => {
    mocked.getList.mockReturnValue(ok([entry({ watched_episodes: 3 })]))
    mocked.updateAnime.mockRejectedValue(new Error('500'))
    renderAt('/?tab=scrolls')

    await userEvent.click(await screen.findByRole('button', { name: /Mark next episode/ }))
    await waitFor(() => expect(mocked.getList).toHaveBeenCalledTimes(2))
    expect(screen.getByText('3 of 28 episodes')).toBeInTheDocument()
  })

  it('only deletes after confirmation', async () => {
    mocked.getList.mockReturnValue(ok([entry()]))
    mocked.deleteAnime.mockReturnValue(ok({ success: true as const }))
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    renderAt('/?tab=scrolls')

    const remove = await screen.findByRole('button', { name: /Remove Sousou no Frieren/ })
    await userEvent.click(remove)
    expect(mocked.deleteAnime).not.toHaveBeenCalled()

    await userEvent.click(remove)
    expect(mocked.deleteAnime).toHaveBeenCalledWith(52991)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Your scrolls are empty' })).toBeInTheDocument())
    confirm.mockRestore()
  })

  it('reads the search query from the URL', async () => {
    mocked.getList.mockReturnValue(ok([]))
    mocked.searchAnime.mockReturnValue(ok({ data: [{ mal_id: 5114, title: 'Fullmetal Alchemist: Brotherhood' }] }))
    renderAt('/?tab=search&q=fullmetal')

    expect(await screen.findByText('Fullmetal Alchemist: Brotherhood')).toBeInTheDocument()
    expect(mocked.searchAnime).toHaveBeenCalledWith('fullmetal')
    expect(screen.getByRole('searchbox', { name: 'Search anime' })).toHaveValue('fullmetal')
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import SearchView, { type SearchState } from './SearchView'

function renderSearch(search: Partial<SearchState>, extra: { inListIds?: Set<number> } = {}) {
  const onRetry = vi.fn()
  const onAdd = vi.fn()
  render(
    <MemoryRouter>
      <SearchView
        query="frieren"
        search={{ key: 'k', results: [], error: null, ...search }}
        loading={false}
        onRetry={onRetry}
        inListIds={extra.inListIds ?? new Set()}
        stampId={null}
        onAdd={onAdd}
      />
    </MemoryRouter>
  )
  return { onRetry, onAdd }
}

describe('SearchView', () => {
  it('explains rate limits and offers a retry', async () => {
    const { onRetry } = renderSearch({ error: 429 })
    expect(screen.getByRole('alert')).toHaveTextContent('Too many searches in a row')
    await userEvent.click(screen.getByRole('button', { name: 'Search again' }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('tells the user when the connection dropped', () => {
    renderSearch({ error: 'network' })
    expect(screen.getByRole('alert')).toHaveTextContent('Your connection dropped')
  })

  it('suggests what to try when nothing matches', () => {
    renderSearch({ results: [] })
    expect(screen.getByText(/Nothing matches “frieren”/)).toBeInTheDocument()
  })

  it('adds titles that are not in the scrolls yet', async () => {
    const results = [
      { mal_id: 1, title: 'Frieren' },
      { mal_id: 2, title: 'Frieren Mini' },
    ]
    const { onAdd } = renderSearch({ results }, { inListIds: new Set([2]) })
    expect(screen.getByRole('heading', { name: /Results for “frieren”/ })).toHaveTextContent('2 titles')
    expect(screen.getByRole('button', { name: 'Frieren Mini is in your scrolls' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Add Frieren to scrolls' }))
    expect(onAdd).toHaveBeenCalledWith(results[0])
  })
})

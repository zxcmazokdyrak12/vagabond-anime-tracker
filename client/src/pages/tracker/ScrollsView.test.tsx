import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ScrollsView from './ScrollsView'
import { entry } from '../../test/fixtures'
import type { ListEntry } from '../../types'

function setup(list: ListEntry[]) {
  const onUpdate = vi.fn()
  const onDelete = vi.fn()
  render(
    <MemoryRouter>
      <ScrollsView list={list} loaded onUpdate={onUpdate} onDelete={onDelete} />
    </MemoryRouter>
  )
  return { onUpdate, onDelete, user: userEvent.setup() }
}

describe('ScrollsView', () => {
  it('invites to browse when the list is empty', () => {
    setup([])
    expect(screen.getByRole('heading', { name: 'Your scrolls are empty' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Browse top anime' })).toHaveAttribute('href', '/?tab=gate')
  })

  it('shows progress and steps episodes up and down', async () => {
    const { onUpdate, user } = setup([entry({ watched_episodes: 17, episodes: 28 })])
    expect(screen.getByText('17 of 28 episodes')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Mark next episode/ }))
    expect(onUpdate).toHaveBeenLastCalledWith(52991, { watched_episodes: 18 })

    await user.click(screen.getByRole('button', { name: /One episode fewer/ }))
    expect(onUpdate).toHaveBeenLastCalledWith(52991, { watched_episodes: 16 })
  })

  it('disables the steps at the edges', () => {
    setup([
      entry({ anime_id: 1, title: 'Fresh', watched_episodes: 0 }),
      entry({ anime_id: 2, title: 'Done', watched_episodes: 28 }),
    ])
    expect(screen.getByRole('button', { name: 'One episode fewer for Fresh' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Mark next episode of Done as watched' })).toBeDisabled()
  })

  it('handles titles with an unknown episode count', () => {
    setup([entry({ episodes: null, watched_episodes: 1 })])
    expect(screen.getByText('1 episode watched')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Mark next episode/ })).toBeEnabled()
  })

  it('sends numeric scores and null to clear', async () => {
    const { onUpdate, user } = setup([entry({ score: 8 })])
    const score = screen.getByRole('combobox', { name: 'Score' })

    await user.selectOptions(score, '10')
    expect(onUpdate).toHaveBeenLastCalledWith(52991, { score: 10 })

    await user.selectOptions(score, 'None')
    expect(onUpdate).toHaveBeenLastCalledWith(52991, { score: null })
  })

  it('filters by status with live counts', async () => {
    const { user } = setup([
      entry({ anime_id: 1, title: 'Frieren', status: 'watching' }),
      entry({ anime_id: 2, title: 'Steins;Gate', status: 'completed' }),
      entry({ anime_id: 3, title: 'Bebop', status: 'completed' }),
    ])
    const filters = screen.getByRole('group', { name: 'Filter by status' })
    expect(within(filters).getByRole('button', { name: /Completed/ })).toHaveTextContent('2')

    await user.click(within(filters).getByRole('button', { name: /Completed/ }))
    expect(screen.queryByText('Frieren')).not.toBeInTheDocument()
    expect(screen.getByText('Bebop')).toBeInTheDocument()

    await user.click(within(filters).getByRole('button', { name: /Dropped/ }))
    expect(screen.getByText('Nothing marked dropped yet.')).toBeInTheDocument()
  })

  it('asks the parent to delete', async () => {
    const { onDelete, user } = setup([entry()])
    await user.click(screen.getByRole('button', { name: 'Remove Sousou no Frieren from scrolls' }))
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ anime_id: 52991 }))
  })

  it('drives a focused row from the keyboard', async () => {
    const { onUpdate, user } = setup([
      entry({ anime_id: 1, title: 'First', watched_episodes: 3 }),
      entry({ anime_id: 2, title: 'Second' }),
    ])
    const first = screen.getByRole('listitem', { name: 'First' })
    first.focus()

    await user.keyboard('+')
    expect(onUpdate).toHaveBeenLastCalledWith(1, { watched_episodes: 4 })
    await user.keyboard('-')
    expect(onUpdate).toHaveBeenLastCalledWith(1, { watched_episodes: 2 })
    await user.keyboard('2')
    expect(onUpdate).toHaveBeenLastCalledWith(1, { status: 'completed' })

    await user.keyboard('j')
    expect(screen.getByRole('listitem', { name: 'Second' })).toHaveFocus()
    await user.keyboard('k')
    expect(first).toHaveFocus()
  })

  it('edits dates, rewatches and notes in the details panel', async () => {
    const { onUpdate, user } = setup([entry({ rewatch_count: 1, notes: null })])
    await user.click(screen.getByRole('button', { name: /^Details/ }))

    await user.click(screen.getByRole('button', { name: 'Add a rewatch' }))
    expect(onUpdate).toHaveBeenLastCalledWith(52991, { rewatch_count: 2 })

    const notes = screen.getByRole('textbox', { name: /Notes/ })
    await user.type(notes, 'Fern is the best')
    expect(onUpdate).not.toHaveBeenCalledWith(52991, expect.objectContaining({ notes: expect.anything() }))
    await user.tab() // заметка сохраняется, когда уходишь из поля
    expect(onUpdate).toHaveBeenLastCalledWith(52991, { notes: 'Fern is the best' })
  })
})


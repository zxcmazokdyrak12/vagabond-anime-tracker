import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders } from 'axios'
import { ImportButton } from './ImportDialog'
import * as api from '../api'

vi.mock('../api', () => ({ importList: vi.fn() }))
const mocked = vi.mocked(api)

const file = (text: string, name = 'animelist.xml') => new File([text], name, { type: 'text/xml' })

describe('ImportButton', () => {
  it('uploads the file and reports what happened', async () => {
    mocked.importList.mockResolvedValue({ data: { total: 3, added: 2, updated: 0, skipped: 1 } } as never)
    const onImported = vi.fn()
    const user = userEvent.setup()
    render(<ImportButton onImported={onImported} />)

    await user.click(screen.getByRole('button', { name: /Import from MyAnimeList/ }))
    await user.click(screen.getByRole('checkbox', { name: /Replace progress/ }))
    await user.upload(screen.getByLabelText('Export file'), file('<myanimelist/>'))

    expect(mocked.importList).toHaveBeenCalledWith('<myanimelist/>', true)
    expect(await screen.findByRole('status')).toHaveTextContent('Added 2 titles, kept 1 you already had.')
    expect(onImported).toHaveBeenCalled()
  })

  it('shows the server’s reason when the file is wrong', async () => {
    mocked.importList.mockRejectedValue(
      new AxiosError('bad', 'ERR', undefined, undefined, {
        status: 400,
        data: { error: 'This is not a MyAnimeList or Shikimori export' },
        statusText: '',
        headers: {},
        config: { headers: new AxiosHeaders() },
      })
    )
    const user = userEvent.setup()
    render(<ImportButton onImported={() => {}} />)
    await user.click(screen.getByRole('button', { name: /Import from MyAnimeList/ }))
    await user.upload(screen.getByLabelText('Export file'), file('hello', 'notes.json'))
    expect(await screen.findByRole('alert')).toHaveTextContent('not a MyAnimeList or Shikimori export')
  })
})

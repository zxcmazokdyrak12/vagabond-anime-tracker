import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import Intro from './Intro'

const okResponse = () => Promise.resolve(new Response('ok', { status: 200 }))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('Intro', () => {
  it('wakes the server and says so when it answers', async () => {
    const fetchMock = vi.fn((url: string) => (void url, okResponse()))
    vi.stubGlobal('fetch', fetchMock)
    render(<Intro onDone={() => {}} />)

    expect(await screen.findByText('The server is awake.')).toBeInTheDocument()
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/\/ping$/)
  })

  it('keeps knocking while the server sleeps and counts the seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const answers = [Promise.reject(new Error('asleep')), okResponse()]
    vi.stubGlobal('fetch', vi.fn(() => answers.shift() ?? okResponse()))
    render(<Intro onDone={() => {}} />)

    expect(screen.getByRole('status')).toHaveTextContent(/Waking the server, 0 s/)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500)
    })
    expect(screen.getByRole('status')).toHaveTextContent('The server is awake.')
  })

  it('enters with the Enter key after the cut', async () => {
    vi.stubGlobal('fetch', vi.fn(okResponse))
    const onDone = vi.fn()
    render(<Intro onDone={onDone} />)

    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onDone).not.toHaveBeenCalled() // сначала играет разрез
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1), { timeout: 2000 })
  })

  it('enters with the button and skips instantly with Esc', async () => {
    vi.stubGlobal('fetch', vi.fn(okResponse))
    const onDone = vi.fn()
    render(<Intro onDone={onDone} />)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onDone).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Enter' }))
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(2), { timeout: 2000 })
  })

  it('gives up politely when the server never answers', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('down'))))
    render(<Intro onDone={() => {}} />)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(95_000)
    })
    expect(screen.getByRole('status')).toHaveTextContent('The server isn’t answering')
  })
})

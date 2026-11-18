import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders } from 'axios'
import AuthPage from './AuthPage'
import * as api from '../api'

vi.mock('../api', async (orig) => ({ ...(await orig<typeof import('../api')>()), login: vi.fn(), register: vi.fn() }))
const mocked = vi.mocked(api)

const serverError = (status: number, error: string) =>
  new AxiosError('fail', 'ERR', undefined, undefined, {
    status,
    data: { error },
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
  })

describe('AuthPage', () => {
  it('signs in and hands the session up', async () => {
    const onLogin = vi.fn()
    const session = { token: 't', user: { id: 1, username: 'musashi', email: 'm@v.jp' } }
    mocked.login.mockResolvedValue({ data: session } as Awaited<ReturnType<typeof api.login>>)
    render(<AuthPage onLogin={onLogin} />)

    await userEvent.type(screen.getByLabelText('Email'), 'm@v.jp')
    await userEvent.type(screen.getByLabelText('Password'), 'takezo{Enter}')

    expect(mocked.login).toHaveBeenCalledWith({ username: '', email: 'm@v.jp', password: 'takezo' })
    expect(onLogin).toHaveBeenCalledWith(session.user, 't')
  })

  it('shows the server’s explanation when sign-in fails', async () => {
    mocked.login.mockRejectedValue(serverError(400, 'Invalid email or password'))
    render(<AuthPage onLogin={() => {}} />)

    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password')
  })

  it('switches to registration and asks for a name', async () => {
    render(<AuthPage onLogin={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Create an account' }))
    expect(screen.getByRole('heading', { name: 'Begin your path' })).toBeInTheDocument()
    expect(screen.getByLabelText('Warrior name')).toBeInTheDocument()
  })
})

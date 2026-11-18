import { useState } from 'react'
import { motion } from 'framer-motion'
import { login, register } from '../api'
import { useTheme } from '../lib/useTheme'

const COPY = {
  login: {
    glyph: '道',
    title: 'Enter the dojo',
    lede: 'Sign in to pick up your scrolls where you left them.',
    submit: 'Sign in',
    busy: 'Signing in…',
    switchText: 'New here?',
    switchAction: 'Create an account',
  },
  register: {
    glyph: '始',
    title: 'Begin your path',
    lede: 'One account keeps your list, progress and scores on every device.',
    submit: 'Create account',
    busy: 'Creating account…',
    switchText: 'Already have an account?',
    switchAction: 'Sign in',
  },
}

export default function AuthPage({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { theme, toggle } = useTheme()
  const copy = COPY[mode]

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await (mode === 'login' ? login : register)(form)
      onLogin(res.data.user, res.data.token)
    } catch (err) {
      setError(
        err.response?.data?.error ||
          (err.response ? 'The server couldn’t sign you in. Try again in a minute.' : 'No connection. Check your network and try again.')
      )
    } finally {
      setLoading(false)
    }
  }

  const switchMode = () => {
    setMode((m) => (m === 'login' ? 'register' : 'login'))
    setError('')
  }

  return (
    <main className="auth">
      <div className="auth__art" aria-hidden="true">
        <motion.span
          key={copy.glyph}
          className="auth__glyph brush"
          initial={{ opacity: 0, filter: 'blur(6px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.9, ease: [0.65, 0, 0.35, 1] }}
        >
          {copy.glyph}
        </motion.span>
        <p className="auth__caption">
          A tracker for the anime you watch, drawn in ink after Takehiko Inoue’s Vagabond.
        </p>
      </div>

      <div className="auth__panel">
        <form className="auth__form" onSubmit={handleSubmit} noValidate>
          <div className="wordmark" style={{ marginBottom: '3rem' }}>
            <span className="wordmark__seal" aria-hidden="true">武</span>
            <span className="wordmark__name">
              Vagabond
              <span className="wordmark__sub">アニメ追跡</span>
            </span>
          </div>

          <h1 className="auth__title">{copy.title}</h1>
          <p className="muted">{copy.lede}</p>

          <div className="auth__fields">
            {mode === 'register' && (
              <div className="input-field">
                <label htmlFor="username">Warrior name</label>
                <input
                  id="username"
                  autoComplete="username"
                  value={form.username}
                  onChange={set('username')}
                  required
                  minLength={2}
                  maxLength={32}
                />
                <small>Shown on your profile, 2 to 32 characters.</small>
              </div>
            )}
            <div className="input-field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} required />
            </div>
            <div className="input-field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={form.password}
                onChange={set('password')}
                required
                minLength={6}
              />
              {mode === 'register' && <small>At least 6 characters.</small>}
            </div>
          </div>

          <button type="submit" className="btn" disabled={loading}>
            {loading ? copy.busy : copy.submit}
          </button>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <p className="auth__switch">
            {copy.switchText}{' '}
            <button type="button" onClick={switchMode}>
              {copy.switchAction}
            </button>
          </p>

          <p className="auth__switch">
            <button type="button" className="theme-toggle" onClick={toggle} style={{ fontWeight: 400, textDecoration: 'none' }}>
              <span className="brush" aria-hidden="true">{theme === 'night' ? '紙' : '夜'}</span>
              {theme === 'night' ? 'Paper theme' : 'Night theme'}
            </button>
          </p>
        </form>
      </div>
    </main>
  )
}

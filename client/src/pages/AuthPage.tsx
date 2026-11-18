import { useState, type ChangeEvent, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { login, register } from '../api'
import { useTheme } from '../lib/useTheme'
import { useT } from '../lib/i18n'
import LangSwitch from '../components/LangSwitch'
import { errorStatus } from '../api'
import type { User } from '../types'
import axios from 'axios'
import InkArt from '../components/InkArt'

type Mode = 'login' | 'register'
type Field = 'username' | 'email' | 'password'

const COPY: Record<Mode, Record<string, string>> = {
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

export default function AuthPage({ onLogin }: { onLogin: (user: User, token: string) => void }) {
  const [mode, setMode] = useState<Mode>('login')
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { theme, toggle } = useTheme()
  const t = useT()
  const copy = Object.fromEntries(Object.entries(COPY[mode]!).map(([k, v]) => [k, k === 'glyph' ? v : t(v)])) as Record<
    string,
    string
  >

  const set = (field: Field) => (e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = mode === 'login' ? await login(form) : await register(form)
      onLogin(res.data.user, res.data.token)
    } catch (err) {
      const serverMessage = axios.isAxiosError(err) ? (err.response?.data as { error?: string })?.error : undefined
      setError(
        (serverMessage && t(serverMessage)) ||
          (errorStatus(err) === 'network'
            ? t('No connection. Check your network and try again.')
            : t('The server couldn’t sign you in. Try again in a minute.'))
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
        <InkArt name="musashi-field" className="auth__figure" />
        <p className="auth__caption">
          {t('A tracker for the anime you watch, drawn in ink after Takehiko Inoue’s Vagabond.')}
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
                <label htmlFor="username">{t('Warrior name')}</label>
                <input
                  id="username"
                  autoComplete="username"
                  value={form.username}
                  onChange={set('username')}
                  required
                  minLength={2}
                  maxLength={32}
                />
                <small>{t('Shown on your profile, 2 to 32 characters.')}</small>
              </div>
            )}
            <div className="input-field">
              <label htmlFor="email">{t('Email')}</label>
              <input id="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} required />
            </div>
            <div className="input-field">
              <label htmlFor="password">{t('Password')}</label>
              <input
                id="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={form.password}
                onChange={set('password')}
                required
                minLength={6}
              />
              {mode === 'register' && <small>{t('At least 6 characters.')}</small>}
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
              {theme === 'night' ? t('Paper theme') : t('Night theme')}
            </button>
          </p>

          <div className="auth__switch">
            <LangSwitch />
          </div>
        </form>
      </div>
    </main>
  )
}

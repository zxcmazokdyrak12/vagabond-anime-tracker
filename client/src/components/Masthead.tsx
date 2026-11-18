import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { User } from '../types'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import BrushStroke from './BrushStroke'
import ShortcutsDialog from './ShortcutsDialog'
import LangSwitch from './LangSwitch'
import { useT } from '../lib/i18n'
import { useTheme } from '../lib/useTheme'

const TABS: { id: TabId; glyph: string; label: string }[] = [
  { id: 'gate', glyph: '門', label: 'The gate' },
  { id: 'scrolls', glyph: '巻', label: 'My scrolls' },
  { id: 'path', glyph: '道', label: 'The path' },
  { id: 'calendar', glyph: '暦', label: 'This week' },
]

export function Wordmark() {
  const t = useT()
  return (
    <Link to="/" className="wordmark" aria-label={t('Vagabond Tracker, home')}>
      <span className="wordmark__seal" aria-hidden="true">武</span>
      <span className="wordmark__name">
        Vagabond
        <span className="wordmark__sub">アニメ追跡</span>
      </span>
    </Link>
  )
}

export type TabId = 'gate' | 'scrolls' | 'path' | 'calendar' | 'search'

interface Props {
  user: User | null
  onLogout: () => void
  activeTab?: TabId
  initialQuery?: string
  /** Сколько тайтлов в свитках — показывается рядом с пунктом меню */
  scrollCount?: number
}

export default function Masthead({ user, onLogout, activeTab, initialQuery = '', scrollCount = 0 }: Props) {
  const t = useT()
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  const [query, setQuery] = useState(initialQuery)
  const [slash, setSlash] = useState(false)
  const [showKeys, setShowKeys] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  // «/» — к поиску, «?» — список клавиш (если не печатаешь в поле)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, [contenteditable="true"]') || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === '/') {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === '?') {
        e.preventDefault()
        setShowKeys((v) => !v)
      } else if (e.key === 'Escape') setShowKeys(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    // Пасхалка: musashi / vagabond — росчерк клинка по экрану
    if (['musashi', 'vagabond'].includes(q.toLowerCase())) {
      setSlash(true)
      setTimeout(() => setSlash(false), 500)
    }
    navigate(`/?tab=search&q=${encodeURIComponent(q)}`)
  }

  return (
    <header className="masthead">
      <AnimatePresence>
        {slash && (
          <motion.div
            className="slash"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          />
        )}
      </AnimatePresence>

      <div className="masthead__row">
        <Wordmark />

        <form className="search" role="search" onSubmit={submit}>
          <label htmlFor="site-search" className="visually-hidden">
            {t('Search anime')}
          </label>
          <input
            ref={searchRef}
            id="site-search"
            type="search"
            placeholder={t('Search anime by title')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit">{t('Search')}</button>
        </form>

        <div className="masthead__user">
          <span className="muted">{user?.username}</span>
          <button
            type="button"
            className="theme-toggle"
            onClick={toggle}
            aria-label={theme === 'night' ? t('Switch to paper theme') : t('Switch to night theme')}
            title={theme === 'night' ? t('Paper') : t('Night')}
          >
            <span className="brush" aria-hidden="true">{theme === 'night' ? '紙' : '夜'}</span>
          </button>
          <button
            type="button"
            className="text-btn"
            onClick={() => setShowKeys(true)}
            aria-keyshortcuts="?"
            title={t('Keyboard shortcuts (?)')}
          >
            {t('Keys')}
          </button>
          <LangSwitch />
          <button type="button" className="text-btn" onClick={onLogout}>
            {t('Sign out')}
          </button>
        </div>
      </div>

      {showKeys && <ShortcutsDialog onClose={() => setShowKeys(false)} />}

      <BrushStroke />

      <nav className="nav" aria-label={t('Sections')}>
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            to={`/?tab=${tab.id}`}
            className="nav__item"
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            <span className="nav__glyph brush" aria-hidden="true">{tab.glyph}</span>
            <span className="nav__label">{t(tab.label)}</span>
            {tab.id === 'scrolls' && scrollCount > 0 && (
              <span className="nav__count">{scrollCount}</span>
            )}
          </Link>
        ))}
      </nav>
    </header>
  )
}

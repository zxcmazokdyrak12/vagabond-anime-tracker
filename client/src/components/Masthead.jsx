import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import BrushStroke from './BrushStroke'
import { useTheme } from '../lib/useTheme'

const TABS = [
  { id: 'gate', glyph: '門', label: 'The gate' },
  { id: 'scrolls', glyph: '巻', label: 'My scrolls' },
  { id: 'path', glyph: '道', label: 'The path' },
]

export function Wordmark() {
  return (
    <Link to="/" className="wordmark" aria-label="Vagabond Tracker, home">
      <span className="wordmark__seal" aria-hidden="true">武</span>
      <span className="wordmark__name">
        Vagabond
        <span className="wordmark__sub">アニメ追跡</span>
      </span>
    </Link>
  )
}

export default function Masthead({ user, onLogout, activeTab, initialQuery = '', scrollCount }) {
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  const [query, setQuery] = useState(initialQuery)
  const [slash, setSlash] = useState(false)

  const submit = (e) => {
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
            Search anime
          </label>
          <input
            id="site-search"
            type="search"
            placeholder="Search anime by title"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit">Search</button>
        </form>

        <div className="masthead__user">
          <span className="muted">{user?.username}</span>
          <button
            type="button"
            className="theme-toggle"
            onClick={toggle}
            aria-label={theme === 'night' ? 'Switch to paper theme' : 'Switch to night theme'}
            title={theme === 'night' ? 'Paper' : 'Night'}
          >
            <span className="brush" aria-hidden="true">{theme === 'night' ? '紙' : '夜'}</span>
          </button>
          <button type="button" className="text-btn" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </div>

      <BrushStroke />

      <nav className="nav" aria-label="Sections">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            to={`/?tab=${tab.id}`}
            className="nav__item"
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            <span className="nav__glyph brush" aria-hidden="true">{tab.glyph}</span>
            <span className="nav__label">{tab.label}</span>
            {tab.id === 'scrolls' && scrollCount > 0 && (
              <span className="nav__count">{scrollCount}</span>
            )}
          </Link>
        ))}
      </nav>
    </header>
  )
}

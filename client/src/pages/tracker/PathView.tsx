import { Link } from 'react-router-dom'
import Enso from '../../components/Enso'
import { STATUSES, STATUS_KEYS } from '../../lib/status'
import type { Stats } from '../../types'
import type { ReactNode } from 'react'

const MINUTES_PER_EPISODE = 24

interface Props {
  stats: Stats | null
  footer?: ReactNode
  /** Чей путь: не задан — свой («you»), иначе имя владельца публичного профиля */
  owner?: string
}

export default function PathView({ stats, footer, owner }: Props) {
  if (!stats) return <Enso label="Tracing your path…" />

  const total = STATUS_KEYS.reduce((sum, k) => sum + (stats[k] || 0), 0)

  if (total === 0 && owner) return <p className="muted">{owner} hasn’t added any titles yet.</p>

  if (total === 0) {
    return (
      <div className="empty">
        <span className="brush" aria-hidden="true">道</span>
        <div>
          <h1 className="page-title">Your path starts with one title</h1>
          <p className="lede" style={{ marginBottom: '1.5rem' }}>
            Add anime to your scrolls and this page will count what you’re watching, what you finished and what you
            left behind.
          </p>
          <Link to="/?tab=gate" className="btn">Browse top anime</Link>
        </div>
      </div>
    )
  }

  const hours = Math.round(((stats.total_episodes || 0) * MINUTES_PER_EPISODE) / 60)

  return (
    <>
      <h1 className="visually-hidden">The path so far</h1>

      <div className="path-glyphs">
        {STATUS_KEYS.map((k) => (
          <div key={k} className="path-glyph">
            <span className={`path-glyph__kanji brush status--${k}`} aria-hidden="true">
              {STATUSES[k].glyph}
            </span>
            <span className="path-glyph__value">{stats[k] || 0}</span>
            <span className="path-glyph__label">{STATUSES[k].label}</span>
          </div>
        ))}
      </div>

      <div className="path-bar" role="img" aria-label={STATUS_KEYS.map((k) => `${STATUSES[k].label}: ${stats[k] || 0}`).join(', ')}>
        {STATUS_KEYS.map((k) =>
          stats[k] ? <span key={k} className={`is-${k}`} style={{ flexGrow: stats[k] }} /> : null
        )}
      </div>
      <p className="muted" style={{ fontSize: 'var(--step--1)' }}>
        {total} {total === 1 ? 'title' : 'titles'} in {owner ? 'their' : 'your'} scrolls
      </p>

      <p className="path-summary">
        {owner ? `${owner} has` : 'You’ve'} watched <strong>{stats.total_episodes || 0}</strong> episodes, roughly {hours}{' '}
        {hours === 1 ? 'hour' : 'hours'} on the road.
        {stats.avg_score ? (
          <>
            {' '}
            {owner ? 'Their' : 'Your'} average score is <strong>{stats.avg_score}</strong>.
          </>
        ) : (
          owner ? '' : ' Score a few titles to see your average.'
        )}
      </p>

      {footer}
    </>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import InkImage from '../../components/InkImage'
import Enso from '../../components/Enso'
import { STATUSES, STATUS_KEYS, plural } from '../../lib/status'
import type { ListEntry, ListPatch, Status } from '../../types'

type OnUpdate = (animeId: number, patch: ListPatch) => void

function Progress({ entry, onStep }: { entry: ListEntry; onStep: (delta: number) => void }) {
  const watched = entry.watched_episodes || 0
  const total = entry.episodes
  const pct = total ? Math.min(100, (watched / total) * 100) : 0

  return (
    <div className="progress">
      {total ? (
        <span className="progress__track" aria-hidden="true">
          <span className="progress__ink" style={{ width: `${pct}%` }} />
        </span>
      ) : null}
      <span className="progress__text">
        {total ? `${watched} of ${plural(total, 'episode')}` : `${plural(watched, 'episode')} watched`}
      </span>
      <span className="step-btns">
        <button
          type="button"
          onClick={() => onStep(-1)}
          disabled={watched <= 0}
          aria-label={`One episode fewer for ${entry.title}`}
        >
          −
        </button>
        <button
          type="button"
          onClick={() => onStep(1)}
          disabled={total != null && total > 0 && watched >= total}
          aria-label={`Mark next episode of ${entry.title} as watched`}
        >
          +
        </button>
      </span>
    </div>
  )
}

function ScrollRow({ entry, onUpdate, onDelete }: { entry: ListEntry; onUpdate: OnUpdate; onDelete: (e: ListEntry) => void }) {
  const step = (d: number) =>
    onUpdate(entry.anime_id, { watched_episodes: Math.max(0, (entry.watched_episodes || 0) + d) })

  return (
    <li className="scroll-row">
      <Link to={`/anime/${entry.anime_id}`} tabIndex={-1} aria-hidden="true">
        <InkImage src={entry.image} />
      </Link>

      <div>
        <Link to={`/anime/${entry.anime_id}`} className="scroll-row__title">
          {entry.title}
        </Link>
        <Progress entry={entry} onStep={step} />
      </div>

      <div className="scroll-row__controls">
        <label className="field">
          Status
          <select
            className={`select status--${entry.status}`}
            value={entry.status}
            onChange={(e) => onUpdate(entry.anime_id, { status: e.target.value as Status })}
          >
            {STATUS_KEYS.map((k) => (
              <option key={k} value={k}>
                {STATUSES[k].glyph} {STATUSES[k].label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          Score
          <select
            className="select"
            value={entry.score || ''}
            onChange={(e) => onUpdate(entry.anime_id, { score: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">None</option>
            {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="remove-btn"
          onClick={() => onDelete(entry)}
          aria-label={`Remove ${entry.title} from scrolls`}
          title="Remove from scrolls"
        >
          ✕
        </button>
      </div>
    </li>
  )
}

interface Props {
  list: ListEntry[]
  loaded: boolean
  onUpdate: OnUpdate
  onDelete: (entry: ListEntry) => void
}

export default function ScrollsView({ list, loaded, onUpdate, onDelete }: Props) {
  const [filter, setFilter] = useState<Status | 'all'>('all')

  if (!loaded) return <Enso label="Unrolling your scrolls…" />

  if (list.length === 0) {
    return (
      <div className="empty">
        <span className="brush" aria-hidden="true">空</span>
        <div>
          <h1 className="page-title">Your scrolls are empty</h1>
          <p className="lede" style={{ marginBottom: '1.5rem' }}>
            Every title you add lands here, where you can track episodes, set a status and give it a score.
          </p>
          <Link to="/?tab=gate" className="btn">Browse top anime</Link>
        </div>
      </div>
    )
  }

  const counts = Object.fromEntries(STATUS_KEYS.map((k) => [k, list.filter((a) => a.status === k).length])) as Record<
    Status,
    number
  >
  const shown = filter === 'all' ? list : list.filter((a) => a.status === filter)

  return (
    <>
      <h1 className="visually-hidden">My scrolls</h1>
      <div className="filters" role="group" aria-label="Filter by status">
        <button type="button" className="filter" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
          All <span className="filter__count">{list.length}</span>
        </button>
        {STATUS_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            className="filter"
            aria-pressed={filter === k}
            onClick={() => setFilter(k)}
          >
            <span className={`brush ${filter === k ? '' : `status--${k}`}`} aria-hidden="true">
              {STATUSES[k].glyph}
            </span>
            {STATUSES[k].label}
            <span className="filter__count">{counts[k]}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="muted">Nothing marked {filter === 'all' ? '' : STATUSES[filter].label.toLowerCase()} yet.</p>
      ) : (
        <ul className="scroll-list">
          {shown.map((entry) => (
            <ScrollRow key={entry.anime_id} entry={entry} onUpdate={onUpdate} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </>
  )
}

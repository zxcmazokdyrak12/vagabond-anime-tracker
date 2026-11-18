import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import InkImage from '../../components/InkImage'
import Enso from '../../components/Enso'
import { STATUSES, STATUS_KEYS, plural } from '../../lib/status'
import type { ListEntry, ListPatch, Status } from '../../types'
import { SORTS, sortEntries, type SortKey } from '../../lib/sort'
import { useT } from '../../lib/i18n'

type OnUpdate = (animeId: number, patch: ListPatch) => void

function Progress({ entry, onStep }: { entry: ListEntry; onStep: (delta: number) => void }) {
  const t = useT()
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
        {total
          ? t('{watched} of {total}', { watched, total: plural(total, 'episode') })
          : t('{episodes} watched', { episodes: plural(watched, 'episode') })}
      </span>
      <span className="step-btns">
        <button
          type="button"
          onClick={() => onStep(-1)}
          disabled={watched <= 0}
          aria-label={t('One episode fewer for {title}', { title: entry.title })}
        >
          −
        </button>
        <button
          type="button"
          onClick={() => onStep(1)}
          disabled={total != null && total > 0 && watched >= total}
          aria-label={t('Mark next episode of {title} as watched', { title: entry.title })}
        >
          +
        </button>
      </span>
    </div>
  )
}

/** Даты, пересмотры и заметка — раскрываются под строкой */
function Details({ entry, onUpdate }: { entry: ListEntry; onUpdate: OnUpdate }) {
  const t = useT()
  const [notes, setNotes] = useState(entry.notes ?? '')
  const [saved, setSaved] = useState(false)
  const rewatches = entry.rewatch_count ?? 0
  const id = `details-${entry.anime_id}`

  const saveNotes = () => {
    if ((entry.notes ?? '') === notes) return
    onUpdate(entry.anime_id, { notes: notes.trim() || null })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="scroll-details" id={id}>
      <label className="field">
        {t('Started')}
        <input
          type="date"
          className="input-date"
          value={entry.started_at ?? ''}
          onChange={(e) => onUpdate(entry.anime_id, { started_at: e.target.value || null })}
        />
      </label>
      <label className="field">
        {t('Finished')}
        <input
          type="date"
          className="input-date"
          value={entry.finished_at ?? ''}
          min={entry.started_at ?? undefined}
          onChange={(e) => onUpdate(entry.anime_id, { finished_at: e.target.value || null })}
        />
      </label>
      <div className="field">
        <span id={`${id}-rw`}>{t('Rewatched')}</span>
        <span className="step-btns" role="group" aria-labelledby={`${id}-rw`}>
          <button
            type="button"
            onClick={() => onUpdate(entry.anime_id, { rewatch_count: rewatches - 1 })}
            disabled={rewatches <= 0}
            aria-label={t('One rewatch fewer')}
          >
            −
          </button>
          <span className="rewatch-count">{plural(rewatches, 'time')}</span>
          <button
            type="button"
            onClick={() => onUpdate(entry.anime_id, { rewatch_count: rewatches + 1 })}
            aria-label={t('Add a rewatch')}
          >
            +
          </button>
        </span>
      </div>
      <label className="field scroll-details__notes">
        <span>
          {t('Notes')} {saved && <span className="saved-mark">{t('saved')}</span>}
        </span>
        <textarea
          className="input-notes"
          rows={3}
          maxLength={2000}
          placeholder={t('What stayed with you, where you stopped, who recommended it…')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
        />
      </label>
    </div>
  )
}

interface RowProps {
  entry: ListEntry
  onUpdate: OnUpdate
  onDelete: (e: ListEntry) => void
  onMove: (from: HTMLElement, delta: number) => void
}

function ScrollRow({ entry, onUpdate, onDelete, onMove }: RowProps) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const step = (d: number) =>
    onUpdate(entry.anime_id, { watched_episodes: Math.max(0, (entry.watched_episodes || 0) + d) })

  // Клавиши работают, когда фокус на самой строке (не в поле ввода)
  const onKeyDown = (e: KeyboardEvent<HTMLLIElement>) => {
    if (e.target !== e.currentTarget || e.metaKey || e.ctrlKey || e.altKey) return
    const status = { '1': 'watching', '2': 'completed', '3': 'planning', '4': 'dropped' }[e.key] as Status | undefined
    if (e.key === '+' || e.key === '=') step(1)
    else if (e.key === '-') step(-1)
    else if (status) onUpdate(entry.anime_id, { status })
    else if (e.key === 'j' || e.key === 'ArrowDown') onMove(e.currentTarget, 1)
    else if (e.key === 'k' || e.key === 'ArrowUp') onMove(e.currentTarget, -1)
    else if (e.key === 'Enter') setOpen((o) => !o)
    else return
    e.preventDefault()
  }

  return (
    <li className="scroll-row" tabIndex={0} aria-label={entry.title} onKeyDown={onKeyDown} data-row>
      <Link to={`/anime/${entry.anime_id}`} tabIndex={-1} aria-hidden="true">
        <InkImage src={entry.image} />
      </Link>

      <div>
        <Link to={`/anime/${entry.anime_id}`} className="scroll-row__title">
          {entry.title}
        </Link>
        <Progress entry={entry} onStep={step} />
        <button
          type="button"
          className="details-toggle"
          aria-expanded={open}
          aria-controls={`details-${entry.anime_id}`}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? t('Hide details') : entry.notes ? t('Details and notes') : t('Details')}
          {(entry.rewatch_count ?? 0) > 0 && t(', rewatched {n}×', { n: entry.rewatch_count ?? 0 })}
        </button>
      </div>

      <div className="scroll-row__controls">
        <label className="field">
          {t('Status')}
          <select
            className={`select status--${entry.status}`}
            value={entry.status}
            onChange={(e) => onUpdate(entry.anime_id, { status: e.target.value as Status })}
          >
            {STATUS_KEYS.map((k) => (
              <option key={k} value={k}>
                {STATUSES[k].glyph} {t(STATUSES[k].label)}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          {t('Score')}
          <select
            className="select"
            value={entry.score || ''}
            onChange={(e) => onUpdate(entry.anime_id, { score: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">{t('None')}</option>
            {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="remove-btn"
          onClick={() => onDelete(entry)}
          aria-label={t('Remove {title} from scrolls', { title: entry.title })}
          title={t('Remove from scrolls')}
        >
          ✕
        </button>
      </div>

      {open && <Details entry={entry} onUpdate={onUpdate} />}
    </li>
  )
}

interface Props {
  list: ListEntry[]
  loaded: boolean
  onUpdate: OnUpdate
  onDelete: (entry: ListEntry) => void
  /** Кнопка импорта — показывается в пустом состоянии и над списком */
  importSlot?: ReactNode
}

export default function ScrollsView({ list, loaded, onUpdate, onDelete, importSlot }: Props) {
  const t = useT()
  const [filter, setFilter] = useState<Status | 'all'>('all')
  const [sort, setSort] = useState<SortKey>('added')
  const listRef = useRef<HTMLUListElement>(null)

  const shown = useMemo(
    () => sortEntries(filter === 'all' ? list : list.filter((a) => a.status === filter), sort),
    [list, filter, sort]
  )

  if (!loaded) return <Enso label="Unrolling your scrolls…" />

  if (list.length === 0) {
    return (
      <div className="empty">
        <span className="brush" aria-hidden="true">空</span>
        <div>
          <h1 className="page-title">{t('Your scrolls are empty')}</h1>
          <p className="lede" style={{ marginBottom: '1.5rem' }}>
            {t('Every title you add lands here, where you can track episodes, set a status and give it a score. Coming from MyAnimeList or Shikimori? Bring your whole list over in one go.')}
          </p>
          <div className="gate-hero__actions">
            <Link to="/?tab=gate" className="btn">
              {t('Browse top anime')}
            </Link>
            {importSlot}
          </div>
        </div>
      </div>
    )
  }

  const counts = Object.fromEntries(STATUS_KEYS.map((k) => [k, list.filter((a) => a.status === k).length])) as Record<
    Status,
    number
  >

  // j / k — к соседней строке
  const move = (from: HTMLElement, delta: number) => {
    const rows = [...(listRef.current?.querySelectorAll<HTMLElement>('[data-row]') ?? [])]
    rows[rows.indexOf(from) + delta]?.focus()
  }

  return (
    <>
      <h1 className="visually-hidden">{t('My scrolls')}</h1>
      <div className="scrolls-toolbar">
        <div className="filters" role="group" aria-label={t('Filter by status')}>
          <button type="button" className="filter" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
            {t('All')} <span className="filter__count">{list.length}</span>
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
              {t(STATUSES[k].label)}
              <span className="filter__count">{counts[k]}</span>
            </button>
          ))}
        </div>
        <div className="scrolls-toolbar__right">
          <label className="field field--inline">
            {t('Sort by')}
            <select className="select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {t(s.label)}
                </option>
              ))}
            </select>
          </label>
          {importSlot}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="muted">
          {t('Nothing marked {status} yet.', { status: filter === 'all' ? '' : t(STATUSES[filter].label).toLowerCase() })}
        </p>
      ) : (
        <ul className="scroll-list" ref={listRef}>
          {shown.map((entry) => (
            <ScrollRow key={entry.anime_id} entry={entry} onUpdate={onUpdate} onDelete={onDelete} onMove={move} />
          ))}
        </ul>
      )}
    </>
  )
}

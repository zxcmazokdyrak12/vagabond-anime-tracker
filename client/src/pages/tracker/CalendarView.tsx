import { useState } from 'react'
import { Link } from 'react-router-dom'
import InkImage from '../../components/InkImage'
import Enso from '../../components/Enso'
import Notice from '../../components/Notice'
import NotifyToggle from '../../components/NotifyToggle'
import { dayKey, groupByDay } from '../../lib/calendar'
import type { CalendarEpisode } from '../../types'

export interface CalendarState {
  status: 'idle' | 'done' | 'error'
  episodes: CalendarEpisode[]
}

function dayLabel(date: Date, now = new Date()) {
  const today = dayKey(now)
  const tomorrow = dayKey(new Date(now.getTime() + 86_400_000))
  const key = dayKey(date)
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  if (key === today) return { title: 'Today', sub: weekday }
  if (key === tomorrow) return { title: 'Tomorrow', sub: weekday }
  return { title: date.toLocaleDateString('en-GB', { weekday: 'long' }), sub: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) }
}

/** Иероглиф дня недели: 日月火水木金土 */
const DAY_KANJI = ['日', '月', '火', '水', '木', '金', '土']

export default function CalendarView({ calendar, onRetry }: { calendar: CalendarState; onRetry: () => void }) {
  // «Сейчас» фиксируем при монтировании: какие серии уже вышли
  const [now] = useState(() => Date.now())

  if (calendar.status === 'error') {
    return (
      <Notice
        tone="error"
        title="The schedule didn’t load"
        action={<button type="button" className="btn btn--ghost" onClick={onRetry}>Try again</button>}
      >
        The anime catalogue isn’t responding. It usually recovers within a minute.
      </Notice>
    )
  }
  if (calendar.status !== 'done') return <Enso label="Reading the airing schedule…" />

  if (!calendar.episodes.length) {
    return (
      <>
      <NotifyToggle />
      <div className="empty">
        <span className="brush" aria-hidden="true">暦</span>
        <div>
          <h1 className="page-title">Nothing airs this week</h1>
          <p className="lede" style={{ marginBottom: '1.5rem' }}>
            New episodes of ongoing anime you’re watching or planning show up here, day by day. Add something from
            this season to fill the week.
          </p>
          <Link to="/?tab=gate" className="btn">
            See this season
          </Link>
        </div>
      </div>
      </>
    )
  }

  return (
    <>
      <h1 className="visually-hidden">This week</h1>
      <NotifyToggle />
      <ol className="calendar">
        {groupByDay(calendar.episodes).map(([key, eps]) => {
          const date = new Date(eps[0]!.airing_at)
          const label = dayLabel(date)
          return (
            <li key={key} className="calendar__day">
              <div className="calendar__date">
                <span className="brush calendar__kanji" aria-hidden="true">
                  {DAY_KANJI[date.getDay()]}
                </span>
                <span>
                  <span className="calendar__title">{label.title}</span>
                  <span className="calendar__sub">{label.sub}</span>
                </span>
              </div>
              <ul className="calendar__episodes">
                {eps.map((ep) => {
                  const at = new Date(ep.airing_at)
                  const aired = at.getTime() <= now
                  const behind = ep.episode - 1 - ep.watched_episodes
                  return (
                    <li key={`${ep.anime_id}-${ep.episode}`} className={`calendar__ep ${aired ? 'is-aired' : ''}`}>
                      <time dateTime={ep.airing_at} className="calendar__time">
                        {at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </time>
                      <Link to={`/anime/${ep.anime_id}`} tabIndex={-1} aria-hidden="true">
                        <InkImage src={ep.image} />
                      </Link>
                      <div>
                        <Link to={`/anime/${ep.anime_id}`} className="scroll-row__title">
                          {ep.title_english || ep.title}
                        </Link>
                        <p className="calendar__meta">
                          Episode {ep.episode}
                          {ep.episodes ? ` of ${ep.episodes}` : ''}
                          {aired ? ', out now' : ''}
                          {ep.status === 'watching' && behind > 0 ? `. You’re ${behind} behind` : ''}
                          {ep.status === 'planning' && ', in your plans'}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </li>
          )
        })}
      </ol>
    </>
  )
}

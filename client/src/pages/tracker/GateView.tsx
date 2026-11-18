import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import InkImage from '../../components/InkImage'
import PosterCard from '../../components/PosterCard'
import Stamp from '../../components/Stamp'
import Enso from '../../components/Enso'
import Notice from '../../components/Notice'
import { posterOf } from '../../lib/status'
import type { Anime, Recommendation } from '../../types'

export interface DiscoverState {
  status: 'idle' | 'done' | 'error'
  top: Anime[]
  season: Anime[]
}

interface AddProps {
  inListIds: Set<number>
  stampId: number | null
  onAdd: (anime: Anime) => void
}

// Место в топе — кандзи-цифрами: цифры кистью читаются плохо (1 похожа на 7)
const KANJI_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

const HERO_SIZE = 5
const AUTOPLAY_MS = 8000

function GateHero({ items, inListIds, stampId, onAdd }: AddProps & { items: Anime[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const anime = items[index]

  // Автопрокрутка; на ховере/фокусе и при «уменьшить движение» — стоп
  useEffect(() => {
    if (paused || items.length < 2) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => setIndex((i) => (i + 1) % items.length), AUTOPLAY_MS)
    return () => clearInterval(id)
  }, [paused, items.length])

  if (!anime) return null
  const go = (d: number) => setIndex((i) => (i + d + items.length) % items.length)
  const inList = inListIds.has(anime.mal_id)

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Highest rated anime"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={anime.mal_id}
          className="gate-hero"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          <Link to={`/anime/${anime.mal_id}`} className="gate-hero__poster" style={{ position: 'relative' }}>
            <InkImage src={posterOf(anime, true)} alt={`${anime.title} poster`} eager />
            <Stamp show={stampId === anime.mal_id} />
          </Link>

          <div className="gate-hero__body">
            <p className="gate-hero__rank">
              <strong>No. {anime.rank || index + 1}</strong> among the highest rated anime
            </p>
            <h1 className="gate-hero__title">
              <Link to={`/anime/${anime.mal_id}`} style={{ textDecoration: 'none' }}>
                {anime.title_english || anime.title}
              </Link>
            </h1>
            <dl className="facts">
              {anime.score && (
                <div><dt>Score</dt><dd>{anime.score}</dd></div>
              )}
              {anime.type && (
                <div><dt>Format</dt><dd>{anime.type}</dd></div>
              )}
              {anime.year && (
                <div><dt>Year</dt><dd>{anime.year}</dd></div>
              )}
              <div><dt>Episodes</dt><dd>{anime.episodes || 'Ongoing'}</dd></div>
            </dl>
            {anime.genres && anime.genres.length > 0 && (
              <p className="genres">{anime.genres.map((g) => g.name).join(', ')}</p>
            )}
            {anime.synopsis && <p className="gate-hero__synopsis">{anime.synopsis}</p>}

            <div className="gate-hero__actions">
              <button type="button" className="btn" onClick={() => onAdd(anime)} disabled={inList}>
                {inList ? 'In your scrolls' : 'Add to scrolls'}
              </button>
              <Link to={`/anime/${anime.mal_id}`} className="btn btn--ghost">
                Open title
              </Link>
              <div className="gate-hero__pager">
                <button type="button" className="icon-btn" onClick={() => go(-1)} aria-label="Previous title">
                  ‹
                </button>
                <button type="button" className="icon-btn" onClick={() => go(1)} aria-label="Next title">
                  ›
                </button>
              </div>
            </div>
          </div>

          {anime.title_japanese && (
            <p className="vertical-title" lang="ja" aria-hidden="true">
              {anime.title_japanese}
            </p>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="hero-dots">
        {items.map((a, i) => (
          <button
            key={a.mal_id}
            type="button"
            onClick={() => setIndex(i)}
            aria-current={i === index ? 'true' : undefined}
            aria-label={`Show ${a.title}`}
          />
        ))}
      </div>
    </section>
  )
}

export default function GateView({
  discover,
  onRetry,
  inListIds,
  stampId,
  onAdd,
  recommendations,
}: AddProps & {
  discover: DiscoverState
  onRetry: () => void
  recommendations?: { items: Recommendation[]; seeds: string[] } | null
}) {
  if (discover.status === 'error') {
    return (
      <Notice
        tone="error"
        title="The catalogue didn't load"
        action={<button type="button" className="btn btn--ghost" onClick={onRetry}>Try again</button>}
      >
        The anime catalogue isn't responding. It usually recovers within a minute.
      </Notice>
    )
  }

  if (discover.status !== 'done') return <Enso label="Opening the gate…" />

  return (
    <>
      <GateHero
        items={discover.top.slice(0, HERO_SIZE)}
        inListIds={inListIds}
        stampId={stampId}
        onAdd={onAdd}
      />

      {recommendations && recommendations.items.length > 0 && (
        <section className="section" aria-labelledby="recs-head">
          <h2 className="section-head" id="recs-head">
            <span className="brush" aria-hidden="true">薦</span>
            For you
            <span className="section-head__aside">
              Because you loved {recommendations.seeds.slice(0, 3).join(', ')}
            </span>
          </h2>
          <ul className="poster-grid poster-grid--row">
            {recommendations.items.slice(0, 6).map((anime) => (
              <PosterCard
                key={anime.mal_id}
                anime={anime}
                inList={inListIds.has(anime.mal_id)}
                stamped={stampId === anime.mal_id}
                onAdd={onAdd}
                note={`Fans of ${anime.because.join(' and ')} liked it`}
              />
            ))}
          </ul>
        </section>
      )}

      <div className="gate-columns section">
        <section aria-labelledby="season-head">
          <h2 className="section-head" id="season-head">
            <span className="brush" aria-hidden="true">今季</span>
            This season
          </h2>
          <ul className="poster-grid">
            {discover.season.map((anime) => (
              <PosterCard
                key={anime.mal_id}
                anime={anime}
                inList={inListIds.has(anime.mal_id)}
                stamped={stampId === anime.mal_id}
                onAdd={onAdd}
              />
            ))}
          </ul>
        </section>

        <section aria-labelledby="top-head">
          <h2 className="section-head" id="top-head">
            <span className="brush" aria-hidden="true">頂</span>
            Top ten
          </h2>
          <ol className="rank-list">
            {discover.top.map((anime, i) => (
              <li key={anime.mal_id}>
                <Link to={`/anime/${anime.mal_id}`}>
                  <span className="rank-list__n" aria-label={`Rank ${i + 1}`}>{KANJI_NUM[i] || i + 1}</span>
                  <InkImage src={posterOf(anime)} />
                  <span>
                    <span className="rank-list__title">{anime.title}</span>
                    <br />
                    <span className="rank-list__meta">
                      {[anime.type, anime.score ? `score ${anime.score}` : null].filter(Boolean).join(', ')}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  )
}

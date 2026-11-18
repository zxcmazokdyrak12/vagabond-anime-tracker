import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getAnimeFull, getAnimeCharacters, getAnimeEpisodes, getList, addAnime, errorStatus } from '../api'
import Masthead from '../components/Masthead'
import InkImage from '../components/InkImage'
import Stamp from '../components/Stamp'
import Enso from '../components/Enso'
import Notice from '../components/Notice'
import { STATUSES, posterOf } from '../lib/status'
import type { Anime, Character, Episode, ListEntry, User } from '../types'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Сервер сам повторяет запросы к Jikan; здесь — запасной повтор на случай холодного старта Render
async function fetchWithRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn()
    } catch (err) {
      const status = errorStatus(err)
      if (i >= attempts || status === 404 || status === 400) throw err
      await sleep(1500 * i)
    }
  }
}

function Section({ id, glyph, title, children }: { id: string; glyph: string; title: string; children: ReactNode }) {
  return (
    <section className="section" aria-labelledby={id}>
      <h2 className="section-head" id={id}>
        <span className="brush" aria-hidden="true">{glyph}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

interface LoadState {
  /** Для какого id и попытки загружено — пока не совпадает с текущими, показываем загрузку */
  key: string | null
  anime: Anime | null
  error: 'missing' | 'down' | null
}

export default function AnimeDetailPage({ user, onLogout }: { user: User; onLogout: () => void }) {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const [state, setState] = useState<LoadState>({ key: null, anime: null, error: null })
  const [characters, setCharacters] = useState<Character[]>([])
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [entry, setEntry] = useState<ListEntry | null>(null) // запись в свитках, если тайтл уже добавлен
  const [adding, setAdding] = useState(false)
  const [reloadNonce, setReloadNonce] = useState(0)

  const loading = state.key !== `${id}#${reloadNonce}`
  const { anime, error } = state
  const openings = anime?.theme?.openings ?? []
  const endings = anime?.theme?.endings ?? []

  useEffect(() => {
    let cancelled = false
    const key = `${id}#${reloadNonce}`

    ;(async () => {
      const listPromise = getList().catch(() => null)
      try {
        const fullRes = await fetchWithRetry(() => getAnimeFull(id))
        if (cancelled) return
        setState({ key, anime: fullRes.data.data, error: null })
      } catch (err) {
        console.error('Failed to load anime:', err)
        if (!cancelled) setState({ key, anime: null, error: errorStatus(err) === 404 ? 'missing' : 'down' })
        return
      }

      // Персонажи, серии и свитки — параллельно; ошибки здесь не критичны
      const [listRes, charRes, epsRes] = await Promise.all([
        listPromise,
        getAnimeCharacters(id).catch(() => null),
        getAnimeEpisodes(id).catch(() => null),
      ])
      if (cancelled) return
      setEntry(listRes?.data.find((a) => a.anime_id === Number(id)) ?? null)
      setCharacters(charRes ? charRes.data.data.slice(0, 12) : [])
      setEpisodes(epsRes ? epsRes.data.data.slice(0, 12) : [])
    })()

    return () => {
      cancelled = true
    }
  }, [id, reloadNonce])

  const handleAdd = async () => {
    if (!anime || entry) return
    setAdding(true)
    try {
      const res = await addAnime({
        anime_id: anime.mal_id,
        title: anime.title,
        image: posterOf(anime),
        episodes: anime.episodes,
        status: 'planning',
      })
      setEntry(res.data)
    } catch (err) {
      console.error('Failed to add anime:', err)
    } finally {
      setTimeout(() => setAdding(false), 700)
    }
  }

  // Если на страницу пришли по прямой ссылке — «назад» ведёт на главную
  const goBack = () => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate('/'))

  return (
    <>
      <Masthead user={user} onLogout={onLogout} />

      <main className="page">
        <button type="button" className="back-link text-btn" onClick={goBack}>
          Back
        </button>

        {loading ? (
          <Enso label="Opening the archive…" />
        ) : error ? (
          <Notice
            tone="error"
            title={error === 'missing' ? 'This title doesn’t exist on MyAnimeList' : 'This title didn’t load'}
            action={
              error === 'missing' ? (
                <Link to="/?tab=gate" className="btn btn--ghost">Browse top anime</Link>
              ) : (
                <button type="button" className="btn btn--ghost" onClick={() => setReloadNonce((n) => n + 1)}>
                  Try again
                </button>
              )
            }
          >
            {error === 'missing'
              ? 'The link may be broken or the entry was removed.'
              : 'Jikan, the MyAnimeList API, isn’t responding. It often recovers within a minute.'}
          </Notice>
        ) : anime ? (
          <article>
            <header className="detail-hero">
              <div className="detail-hero__poster">
                <InkImage src={posterOf(anime, true)} alt={`${anime.title} poster`} eager />
                <Stamp show={adding} />
              </div>

              <div>
                {anime.airing && <p className="airing">Airing now</p>}
                <h1 className="detail-hero__title">{anime.title_english || anime.title}</h1>
                {anime.title_english && anime.title_english !== anime.title && (
                  <p className="muted" style={{ marginTop: '-0.5rem', marginBottom: '1rem' }}>{anime.title}</p>
                )}

                <dl className="facts">
                  <div><dt>Score</dt><dd>{anime.score ?? '—'}</dd></div>
                  {anime.rank && <div><dt>Rank</dt><dd>No. {anime.rank}</dd></div>}
                  {anime.studios?.[0] && <div><dt>Studio</dt><dd>{anime.studios[0].name}</dd></div>}
                  {anime.year && <div><dt>Year</dt><dd>{anime.year}</dd></div>}
                  <div><dt>Episodes</dt><dd>{anime.episodes || 'Unknown'}</dd></div>
                </dl>

                {anime.genres && anime.genres.length > 0 && (
                  <p className="genres">{anime.genres.map((g) => g.name).join(', ')}</p>
                )}

                {entry ? (
                  <p>
                    In your scrolls as{' '}
                    <strong className={`status--${entry.status}`}>
                      {STATUSES[entry.status]?.label.toLowerCase()}
                    </strong>
                    {entry.episodes ? `, ${entry.watched_episodes || 0} of ${entry.episodes} episodes` : ''}.{' '}
                    <Link to="/?tab=scrolls">Open my scrolls</Link>
                  </p>
                ) : (
                  <button type="button" className="btn" onClick={handleAdd} disabled={adding}>
                    {adding ? 'Adding…' : 'Add to scrolls'}
                  </button>
                )}
              </div>

              {anime.title_japanese && (
                <p className="vertical-title" lang="ja" aria-hidden="true">{anime.title_japanese}</p>
              )}
            </header>

            <div className="detail-body">
              <div>
                {anime.synopsis && (
                  <Section id="synopsis" glyph="概" title="Story">
                    <p className="prose">{anime.synopsis.replace(/\s*\[Written by MAL Rewrite\]\s*$/, '')}</p>
                  </Section>
                )}

                {anime.trailer?.embed_url && (
                  <Section id="trailer" glyph="予" title="Trailer">
                    <div className="trailer">
                      <iframe src={anime.trailer.embed_url} title={`${anime.title} trailer`} allowFullScreen loading="lazy" />
                    </div>
                  </Section>
                )}

                {characters.length > 0 && (
                  <Section id="cast" glyph="人" title="Characters">
                    <ul className="char-grid">
                      {characters.map((c) => (
                        <li key={c.character.mal_id} className="char">
                          <InkImage src={c.character.images?.jpg?.image_url} />
                          <div>
                            <p className="char__name">{c.character.name}</p>
                            <p className="char__meta">
                              {c.role}
                              {c.voice_actors?.[0] ? `, voiced by ${c.voice_actors[0].person.name}` : ''}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {episodes.length > 0 && (
                  <Section id="episodes" glyph="話" title="Episodes">
                    <ol className="episode-list">
                      {episodes.map((ep) => (
                        <li key={ep.mal_id}>
                          <span className="episode-list__n" aria-label={`Episode ${ep.mal_id}`}>{ep.mal_id}</span>
                          <span>{ep.title}</span>
                          {ep.aired && (
                            <time className="muted" dateTime={ep.aired}>
                              {new Date(ep.aired).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </time>
                          )}
                        </li>
                      ))}
                    </ol>
                  </Section>
                )}
              </div>

              <aside>
                <Section id="info" glyph="情" title="Details">
                  <dl className="info-list">
                    {[
                      ['Format', anime.type],
                      ['Status', anime.status],
                      ['Aired', anime.aired?.string],
                      ['Source', anime.source],
                      ['Episode length', anime.duration],
                      ['Rating', anime.rating],
                      ['Members', anime.members?.toLocaleString('en')],
                    ]
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
                      ))}
                  </dl>
                </Section>

                {(openings.length > 0 || endings.length > 0) && (
                  <Section id="songs" glyph="歌" title="Theme songs">
                    {openings.length > 0 && (
                      <>
                        <h3 className="sub-head">Opening</h3>
                        <ul className="song-list">
                          {openings.map((t, i) => <li key={i}>{t}</li>)}
                        </ul>
                      </>
                    )}
                    {endings.length > 0 && (
                      <>
                        <h3 className="sub-head">Ending</h3>
                        <ul className="song-list">
                          {endings.map((t, i) => <li key={i}>{t}</li>)}
                        </ul>
                      </>
                    )}
                  </Section>
                )}
              </aside>
            </div>
          </article>
        ) : null}
      </main>
    </>
  )
}

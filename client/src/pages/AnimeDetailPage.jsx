import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getAnimeFull, getAnimeCharacters, getAnimeEpisodes, getList, addAnime } from '../api'
import Masthead from '../components/Masthead'
import InkImage from '../components/InkImage'
import Stamp from '../components/Stamp'
import Enso from '../components/Enso'
import Notice from '../components/Notice'
import { STATUSES, posterOf } from '../lib/status'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Jikan часто отвечает 429/5xx — повторяем с нарастающей паузой
async function fetchWithRetry(fn, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      const status = err.response?.status
      if ([429, 502, 503, 504].includes(status) && i < attempts - 1) {
        await sleep(1000 * (i + 1))
        continue
      }
      throw err
    }
  }
}

function Section({ id, glyph, title, children }) {
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

export default function AnimeDetailPage({ user, onLogout }) {
  const { id } = useParams()
  const navigate = useNavigate()

  const [state, setState] = useState({ id: null, anime: null, error: null })
  const [characters, setCharacters] = useState([])
  const [episodes, setEpisodes] = useState([])
  const [entry, setEntry] = useState(null) // запись в свитках, если тайтл уже добавлен
  const [adding, setAdding] = useState(false)
  const [reloadNonce, setReloadNonce] = useState(0)

  const loading = state.id !== `${id}#${reloadNonce}`
  const { anime, error } = state

  useEffect(() => {
    let cancelled = false
    const key = `${id}#${reloadNonce}`

    ;(async () => {
      const listPromise = getList().catch(() => null)
      try {
        const fullRes = await fetchWithRetry(() => getAnimeFull(id))
        if (cancelled) return
        setState({ id: key, anime: fullRes.data.data, error: null })
      } catch (err) {
        console.error('Failed to load anime:', err)
        if (!cancelled) setState({ id: key, anime: null, error: err.response?.status === 404 ? 'missing' : 'down' })
        return
      }

      const listRes = await listPromise
      if (!cancelled) setEntry(listRes?.data.find((a) => a.anime_id === Number(id)) || null)

      await sleep(600)
      const charRes = await fetchWithRetry(() => getAnimeCharacters(id), 4).catch(() => null)
      if (!cancelled) setCharacters(charRes ? charRes.data.data.slice(0, 12) : [])

      await sleep(400)
      const epsRes = await fetchWithRetry(() => getAnimeEpisodes(id)).catch(() => null)
      if (!cancelled) setEpisodes(epsRes ? epsRes.data.data.slice(0, 12) : [])
    })()

    return () => { cancelled = true }
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
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/'))

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

                {anime.genres?.length > 0 && (
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

                {(anime.theme?.openings?.length > 0 || anime.theme?.endings?.length > 0) && (
                  <Section id="songs" glyph="歌" title="Theme songs">
                    {anime.theme.openings?.length > 0 && (
                      <>
                        <h3 className="sub-head">Opening</h3>
                        <ul className="song-list">
                          {anime.theme.openings.map((t, i) => <li key={i}>{t}</li>)}
                        </ul>
                      </>
                    )}
                    {anime.theme.endings?.length > 0 && (
                      <>
                        <h3 className="sub-head">Ending</h3>
                        <ul className="song-list">
                          {anime.theme.endings.map((t, i) => <li key={i}>{t}</li>)}
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

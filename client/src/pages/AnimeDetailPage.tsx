import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getAnimeFull, getAnimeCharacters, getAnimeEpisodes, getList, addAnime, errorStatus } from '../api'
import Masthead from '../components/Masthead'
import InkImage from '../components/InkImage'
import Stamp from '../components/Stamp'
import Enso from '../components/Enso'
import Notice from '../components/Notice'
import { STATUSES, posterOf } from '../lib/status'
import { locale, plural, t as tr, useT } from '../lib/i18n'
import type { Anime, Character, Episode, ListEntry, User } from '../types'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Сервер сам повторяет запросы к каталогам; здесь — запасной повтор на случай холодного старта Render
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
  const t = useT()
  return (
    <section className="section" aria-labelledby={id}>
      <h2 className="section-head" id={id}>
        <span className="brush" aria-hidden="true">{glyph}</span>
        {t(title)}
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
  const t = useT()

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
          {t('Back')}
        </button>

        {loading ? (
          <Enso label="Opening the archive…" />
        ) : error ? (
          <Notice
            tone="error"
            title={error === 'missing' ? t('This title doesn’t exist on MyAnimeList') : t('This title didn’t load')}
            action={
              error === 'missing' ? (
                <Link to="/?tab=gate" className="btn btn--ghost">{t('Browse top anime')}</Link>
              ) : (
                <button type="button" className="btn btn--ghost" onClick={() => setReloadNonce((n) => n + 1)}>
                  {t('Try again')}
                </button>
              )
            }
          >
            {error === 'missing'
              ? t('The link may be broken or the entry was removed.')
              : t('The anime catalogue isn’t responding. It usually recovers within a minute.')}
          </Notice>
        ) : anime ? (
          <article>
            <header className="detail-hero">
              <div className="detail-hero__poster">
                <InkImage src={posterOf(anime, true)} alt={t('{title} poster', { title: anime.title })} eager />
                <Stamp show={adding} />
              </div>

              <div>
                {anime.airing && (
                  <p className="airing">
                    {anime.next_airing
                      ? t('Episode {n} airs {when}', {
                          n: anime.next_airing.episode,
                          when: new Date(anime.next_airing.at).toLocaleString(locale(), {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          }),
                        })
                      : t('Airing now')}
                  </p>
                )}
                <h1 className="detail-hero__title">{anime.title_english || anime.title}</h1>
                {anime.title_english && anime.title_english !== anime.title && (
                  <p className="muted" style={{ marginTop: '-0.5rem', marginBottom: '1rem' }}>{anime.title}</p>
                )}

                <dl className="facts">
                  <div><dt>{t('Score')}</dt><dd>{anime.score ?? '—'}</dd></div>
                  {anime.rank && <div><dt>{t('Rank')}</dt><dd>{t('No. {n}', { n: anime.rank })}</dd></div>}
                  {anime.studios?.[0] && <div><dt>{t('Studio')}</dt><dd>{anime.studios[0].name}</dd></div>}
                  {anime.year && <div><dt>{t('Year')}</dt><dd>{anime.year}</dd></div>}
                  <div><dt>{t('Episodes')}</dt><dd>{anime.episodes || t('Unknown')}</dd></div>
                </dl>

                {anime.genres && anime.genres.length > 0 && (
                  <p className="genres">{anime.genres.map((g) => t(g.name)).join(', ')}</p>
                )}

                {entry ? (
                  <p>
                    {t('In your scrolls as')}{' '}
                    <strong className={`status--${entry.status}`}>
                      {t(STATUSES[entry.status]?.label ?? '').toLowerCase()}
                    </strong>
                    {entry.episodes
                      ? `, ${t('{watched} of {total}', { watched: entry.watched_episodes || 0, total: plural(entry.episodes, 'episode') })}`
                      : ''}
                    .{' '}
                    <Link to="/?tab=scrolls">{t('Open my scrolls')}</Link>
                  </p>
                ) : (
                  <button type="button" className="btn" onClick={handleAdd} disabled={adding}>
                    {adding ? t('Adding…') : t('Add to scrolls')}
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
                      <iframe src={anime.trailer.embed_url} title={t('{title} trailer', { title: anime.title })} allowFullScreen loading="lazy" />
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
                              {t(c.role)}
                              {c.voice_actors?.[0] ? `, ${t('voiced by {name}', { name: c.voice_actors[0].person.name })}` : ''}
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
                          <span className="episode-list__n" aria-label={t('Episode {n}', { n: ep.mal_id })}>{ep.mal_id}</span>
                          <span>{ep.title}</span>
                          {ep.aired && (
                            <time className="muted" dateTime={ep.aired}>
                              {new Date(ep.aired).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' })}
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
                      ['Format', anime.type && t(anime.type)],
                      ['Status', anime.status && t(anime.status)],
                      ['Aired', anime.aired?.string],
                      ['Source', anime.source && t(anime.source)],
                      ['Episode length', anime.duration && tr('{n} min per ep', { n: parseInt(anime.duration, 10) || anime.duration })],
                      ['Rating', anime.rating],
                      ['In users’ lists', anime.members?.toLocaleString(locale())],
                    ]
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <div key={k}><dt>{t(k!)}</dt><dd>{v}</dd></div>
                      ))}
                  </dl>
                </Section>

                {(openings.length > 0 || endings.length > 0) && (
                  <Section id="songs" glyph="歌" title="Theme songs">
                    {openings.length > 0 && (
                      <>
                        <h3 className="sub-head">{t('Opening')}</h3>
                        <ul className="song-list">
                          {openings.map((song, i) => <li key={i}>{song}</li>)}
                        </ul>
                      </>
                    )}
                    {endings.length > 0 && (
                      <>
                        <h3 className="sub-head">{t('Ending')}</h3>
                        <ul className="song-list">
                          {endings.map((song, i) => <li key={i}>{song}</li>)}
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

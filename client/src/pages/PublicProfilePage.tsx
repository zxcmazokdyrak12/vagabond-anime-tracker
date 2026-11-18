import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { errorStatus, getPublicProfile } from '../api'
import BrushStroke from '../components/BrushStroke'
import Enso from '../components/Enso'
import InkImage from '../components/InkImage'
import Notice from '../components/Notice'
import PathView from './tracker/PathView'
import { STATUSES, STATUS_KEYS, plural } from '../lib/status'
import type { PublicProfile } from '../types'

/** Чужой «путь» по ссылке /u/:username — только чтение, вход не нужен */
export default function PublicProfilePage({ signedIn }: { signedIn: boolean }) {
  const { username = '' } = useParams()
  const [state, setState] = useState<{ key: string; profile: PublicProfile | null; error: 'missing' | 'down' | null }>({
    key: '',
    profile: null,
    error: null,
  })
  const loading = state.key !== username

  useEffect(() => {
    let cancelled = false
    getPublicProfile(username)
      .then((res) => !cancelled && setState({ key: username, profile: res.data, error: null }))
      .catch((err) => !cancelled && setState({ key: username, profile: null, error: errorStatus(err) === 404 ? 'missing' : 'down' }))
    return () => {
      cancelled = true
    }
  }, [username])

  const { profile, error } = state

  return (
    <>
      <header className="masthead">
        <div className="masthead__row">
          <Link to="/" className="wordmark" aria-label="Vagabond Tracker, home">
            <span className="wordmark__seal" aria-hidden="true">武</span>
            <span className="wordmark__name">
              Vagabond
              <span className="wordmark__sub">アニメ追跡</span>
            </span>
          </Link>
          <Link to="/" className="btn btn--ghost btn--small">
            {signedIn ? 'Back to my scrolls' : 'Start your own path'}
          </Link>
        </div>
        <BrushStroke />
      </header>

      <main className="page">
        {loading ? (
          <Enso label="Unrolling the scrolls…" />
        ) : error ? (
          <Notice
            tone={error === 'down' ? 'error' : 'neutral'}
            title={error === 'missing' ? 'This path is private or does not exist' : 'The profile did not load'}
          >
            {error === 'missing'
              ? 'Its owner may have closed it, or the link has a typo.'
              : 'The server is not answering. Try again in a minute.'}
          </Notice>
        ) : profile ? (
          <>
            <h1 className="page-title">{profile.username}</h1>
            <p className="lede">
              On the road since{' '}
              {new Date(profile.member_since).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}.
            </p>

            <div className="section">
              <PathView stats={profile.stats} owner={profile.username} />
            </div>

            {STATUS_KEYS.map((status) => {
              const items = profile.list.filter((e) => e.status === status)
              if (!items.length) return null
              return (
                <section key={status} className="section" aria-labelledby={`pub-${status}`}>
                  <h2 className="section-head" id={`pub-${status}`}>
                    <span className={`brush status--${status}`} aria-hidden="true">
                      {STATUSES[status].glyph}
                    </span>
                    {STATUSES[status].label}
                    <span className="section-head__aside">{plural(items.length, 'title')}</span>
                  </h2>
                  <ul className="poster-grid">
                    {items.map((e) => (
                      <li key={e.anime_id} className="poster">
                        <Link to={`/anime/${e.anime_id}`} className="poster__link">
                          <InkImage src={e.image} />
                          <span className="poster__title">{e.title}</span>
                        </Link>
                        <span className="poster__meta">
                          {[e.score ? `Scored ${e.score}` : null, e.episodes ? `${e.watched_episodes}/${e.episodes} ep.` : null]
                            .filter(Boolean)
                            .join(', ') || ' '}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </>
        ) : null}
      </main>
    </>
  )
}

import PosterCard from '../../components/PosterCard'
import Enso from '../../components/Enso'
import Notice from '../../components/Notice'

const ERRORS = {
  429: 'Too many searches in a row. Wait a few seconds, then try again.',
  502: 'The anime catalogues aren’t responding right now. Try again in a minute.',
}

export default function SearchView({ query, search, loading, onRetry, inListIds, stampId, onAdd }) {
  if (!query) {
    return <Notice title="Type a title in the search field above">English and romaji titles both work.</Notice>
  }

  if (loading) return <Enso label={`Searching for “${query}”…`} />

  if (search.error) {
    return (
      <Notice
        tone="error"
        title="Search didn’t go through"
        action={<button type="button" className="btn btn--ghost" onClick={onRetry}>Search again</button>}
      >
        {search.error === 'network'
          ? 'Your connection dropped. Check it and search again.'
          : ERRORS[search.error] || `The server answered with an error (${search.error}). Try again in a minute.`}
      </Notice>
    )
  }

  return (
    <>
      <h1 className="section-head">
        Results for “{query}”
        <span className="section-head__aside">
          {search.results.length} {search.results.length === 1 ? 'title' : 'titles'}
        </span>
      </h1>

      {search.results.length === 0 ? (
        <p className="muted">
          Nothing matches “{query}”. Check the spelling or try the Japanese title in romaji, like “Shingeki no
          Kyojin”.
        </p>
      ) : (
        <ul className="poster-grid">
          {search.results.map((anime) => (
            <PosterCard
              key={anime.mal_id}
              anime={anime}
              inList={inListIds.has(anime.mal_id)}
              stamped={stampId === anime.mal_id}
              onAdd={onAdd}
            />
          ))}
        </ul>
      )}
    </>
  )
}

import PosterCard from '../../components/PosterCard'
import Enso from '../../components/Enso'
import Notice from '../../components/Notice'
import type { Anime } from '../../types'
import { plural, useT } from '../../lib/i18n'
import InkArt from '../../components/InkArt'

export interface SearchState {
  key: string | null
  results: Anime[]
  error: number | 'network' | null
}

interface Props {
  query: string
  search: SearchState
  loading: boolean
  onRetry: () => void
  inListIds: Set<number>
  stampId: number | null
  onAdd: (anime: Anime) => void
}

const ERRORS: Record<number, string> = {
  429: 'Too many searches in a row. Wait a few seconds, then try again.',
  502: 'The anime catalogues aren’t responding right now. Try again in a minute.',
}

export default function SearchView({ query, search, loading, onRetry, inListIds, stampId, onAdd }: Props) {
  const t = useT()
  if (!query) {
    return <Notice title={t('Type a title in the search field above')}>{t('English and romaji titles both work.')}</Notice>
  }

  if (loading) return <Enso label={t('Searching for “{q}”…', { q: query })} />

  if (search.error) {
    return (
      <Notice
        tone="error"
        art="blind-sword"
        title={t('Search didn’t go through')}
        action={<button type="button" className="btn btn--ghost" onClick={onRetry}>{t('Search again')}</button>}
      >
        {search.error === 'network'
          ? t('Your connection dropped. Check it and search again.')
          : ERRORS[search.error]
            ? t(ERRORS[search.error]!)
            : t('The server answered with an error ({code}). Try again in a minute.', { code: search.error })}
      </Notice>
    )
  }

  return (
    <>
      <h1 className="section-head">
        {t('Results for “{q}”', { q: query })}
        <span className="section-head__aside">{plural(search.results.length, 'title')}</span>
      </h1>

      {search.results.length === 0 ? (
        <div className="empty empty--art empty--small">
          <InkArt name="blind-sword" className="empty__art" />
          <p className="muted">
            {t('Nothing matches “{q}”. Check the spelling or try the Japanese title in romaji, like “Shingeki no Kyojin”.', { q: query })}
          </p>
        </div>
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

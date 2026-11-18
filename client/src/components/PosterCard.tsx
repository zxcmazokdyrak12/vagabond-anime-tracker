import { Link } from 'react-router-dom'
import InkImage from './InkImage'
import Stamp from './Stamp'
import { posterOf } from '../lib/status'
import type { Anime } from '../types'
import { useT } from '../lib/i18n'

interface Props {
  anime: Anime
  inList: boolean
  /** Сейчас на постер ставится печать «録» */
  stamped: boolean
  onAdd: (anime: Anime) => void
  /** Строка-пояснение под названием, например «почему рекомендуем» */
  note?: string
}

// Постер тайтла в сетке: картинка-ссылка, название, кнопка «в свитки»
export default function PosterCard({ anime, inList, stamped, onAdd, note }: Props) {
  const t = useT()
  const meta = [
    anime.score ? t('Score {n}', { n: anime.score }) : null,
    anime.episodes ? t('{n} ep.', { n: anime.episodes }) : null,
  ].filter(Boolean)

  return (
    <li className="poster">
      <Link to={`/anime/${anime.mal_id}`} className="poster__link">
        <InkImage src={posterOf(anime)} />
        <span className="poster__title">{anime.title}</span>
      </Link>
      <span className="poster__meta">{note ?? (meta.length ? meta.join(', ') : '\u00a0')}</span>
      <Stamp show={stamped} />
      <button
        type="button"
        className="btn btn--ghost btn--small"
        onClick={() => onAdd(anime)}
        disabled={inList}
        aria-label={inList ? t('{title} is in your scrolls', { title: anime.title }) : t('Add {title} to scrolls', { title: anime.title })}
      >
        {inList ? t('In your scrolls') : t('Add to scrolls')}
      </button>
    </li>
  )
}

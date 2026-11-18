import { Link } from 'react-router-dom'
import InkImage from './InkImage'
import Stamp from './Stamp'
import { posterOf } from '../lib/status'

// Постер тайтла в сетке: картинка-ссылка, название, кнопка «в свитки»
export default function PosterCard({ anime, inList, stamped, onAdd }) {
  const meta = [
    anime.score && `Score ${anime.score}`,
    anime.episodes ? `${anime.episodes} ep.` : null,
  ].filter(Boolean)

  return (
    <li className="poster">
      <Link to={`/anime/${anime.mal_id}`} className="poster__link">
        <InkImage src={posterOf(anime)} />
        <span className="poster__title">{anime.title}</span>
      </Link>
      <span className="poster__meta">{meta.length ? meta.join(', ') : ' '}</span>
      <Stamp show={stamped} />
      <button
        type="button"
        className="btn btn--ghost btn--small"
        onClick={() => onAdd(anime)}
        disabled={inList}
        aria-label={inList ? `${anime.title} is in your scrolls` : `Add ${anime.title} to scrolls`}
      >
        {inList ? 'In your scrolls' : 'Add to scrolls'}
      </button>
    </li>
  )
}

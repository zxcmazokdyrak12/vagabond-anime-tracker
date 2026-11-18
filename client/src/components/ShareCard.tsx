import { useEffect, useRef, useState } from 'react'
import { canvasToBlob, drawPathCard } from '../lib/shareCard'
import type { ListEntry, Stats } from '../types'
import { getLang, useT } from '../lib/i18n'

interface Props {
  username: string
  stats: Stats
  list: ListEntry[]
  hours: number
  isPublic: boolean
}

/** Карточка «Мой путь» картинкой: сохранить или отправить в сторис/мессенджер */
export default function ShareCard({ username, stats, list, hours, isPublic }: Props) {
  const t = useT()
  const lang = getLang()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  const [note, setNote] = useState('')

  const favourites = [...list]
    .filter((e) => e.score)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 3)
  const url = isPublic ? `${window.location.origin}/u/${encodeURIComponent(username)}` : window.location.origin
  const favKey = favourites.map((f) => `${f.anime_id}:${f.score}`).join(',')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    drawPathCard(canvas, { username, stats, favourites, hours, url }).then(() => !cancelled && setReady(true))
    return () => {
      cancelled = true
    }
    // favourites пересчитываются каждый рендер — сравниваем по ключу
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, stats, favKey, hours, url, lang])

  const fileName = `vagabond-path-${username}.png`

  const download = async () => {
    const blob = await canvasToBlob(canvasRef.current!)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = fileName
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  const share = async () => {
    const blob = await canvasToBlob(canvasRef.current!)
    const file = new File([blob], fileName, { type: 'image/png' })
    try {
      await navigator.share({ files: [file], title: t('My path'), text: isPublic ? url : undefined })
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setNote(t('Sharing didn’t work here. Save the image instead.'))
    }
  }

  const canShareFiles =
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] })

  return (
    <section className="section share-card" aria-labelledby="card-head">
      <h2 className="section-head" id="card-head">
        <span className="brush" aria-hidden="true">絵</span>
        {t('Your path as a picture')}
      </h2>
      <div className="share-card__row">
        <canvas ref={canvasRef} className="share-card__canvas" role="img" aria-label={t('Path card for {name}', { name: username })} />
        <div>
          <p className="lede" style={{ marginBottom: '1.25rem' }}>
            {t('A card for stories and chats, in the current theme. Switch to night first for a dark one.')}
          </p>
          <div className="gate-hero__actions">
            <button type="button" className="btn" onClick={download} disabled={!ready}>
              {t('Save image')}
            </button>
            {canShareFiles && (
              <button type="button" className="btn btn--ghost" onClick={share} disabled={!ready}>
                {t('Share')}
              </button>
            )}
          </div>
          {note && (
            <p className="form-error" role="status">
              {note}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

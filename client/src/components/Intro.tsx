import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { API_URL } from '../api'
import { useServerWake } from '../lib/useServerWake'
import { useT } from '../lib/i18n'

/** Сколько длится разрез — после него заставка убирается */
export const CUT_MS = 900
/** Какую долю ширины экрана нужно протянуть, чтобы удар засчитался */
const SLASH_MIN_SHARE = 0.3

interface Props {
  onDone: () => void
}

interface Stroke {
  x1: number
  y1: number
  x2: number
  y2: number
}

// Энсо: круг одним движением кисти. Чуть не замкнут — так рисуют по канону
const ENSO_PATH =
  'M188 62c-22-30-62-46-104-36C38 37 8 80 14 128c6 47 47 82 96 80 52-2 90-42 88-92-1-24-10-44-24-58'

/**
 * Лист с энсо. До удара — один цельный (`whole`): у двух наложенных половинок
 * сглаживание и фильтр кисти оставляли шов. В момент разреза цельный лист
 * подменяется двумя половинками с уже дорисованной картинкой, и они разъезжаются.
 */
function Sheet({ side }: { side: 'whole' | 'a' | 'b' }) {
  const reduce = useReducedMotion()
  const half = side !== 'whole'
  // Половинки появляются уже дорисованными — анимация рисования только у цельного листа
  const instant = reduce || half
  const away = side === 'a' ? { x: '-6%', y: '-9%', rotate: -3 } : { x: '6%', y: '9%', rotate: 3 }

  return (
    <motion.div
      className={`intro__sheet intro__sheet--${side}`}
      aria-hidden="true"
      initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
      animate={half ? { ...away, opacity: 0 } : undefined}
      transition={{ duration: reduce ? 0 : CUT_MS / 1000, ease: [0.7, 0, 0.2, 1], delay: reduce ? 0 : 0.12 }}
    >
      <div className="intro__art">
        <svg className="intro__enso" viewBox="0 0 220 220">
          <defs>
            <filter id={`enso-rough-${side}`} x="-10%" y="-10%" width="120%" height="120%">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" />
              <feDisplacementMap in="SourceGraphic" scale="5" />
            </filter>
          </defs>
          {/* Два прохода разной толщины — неровный мазок вместо циркульной линии */}
          <motion.path
            d={ENSO_PATH}
            fill="none"
            stroke="currentColor"
            strokeWidth="14"
            strokeLinecap="round"
            filter={`url(#enso-rough-${side})`}
            initial={{ pathLength: instant ? 1 : 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: instant ? 0 : 1.6, ease: [0.55, 0, 0.25, 1] }}
          />
          <motion.path
            d={ENSO_PATH}
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
            opacity="0.55"
            transform="translate(3 -2)"
            filter={`url(#enso-rough-${side})`}
            initial={{ pathLength: instant ? 0.93 : 0 }}
            animate={{ pathLength: 0.93 }}
            transition={{ duration: instant ? 0 : 1.5, ease: [0.55, 0, 0.25, 1], delay: instant ? 0 : 0.08 }}
          />
        </svg>
        <motion.span
          className="intro__kanji brush"
          initial={{ opacity: instant ? 1 : 0, filter: instant ? 'blur(0px)' : 'blur(14px)', scale: instant ? 1 : 1.08 }}
          animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
          transition={{ duration: instant ? 0 : 1.1, delay: instant ? 0 : 1.2, ease: 'easeOut' }}
        >
          武
        </motion.span>
      </div>
    </motion.div>
  )
}

export default function Intro({ onDone }: Props) {
  const t = useT()
  const { status, elapsed } = useServerWake(API_URL)
  const [cut, setCut] = useState(false)
  const [stroke, setStroke] = useState<Stroke | null>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const reduce = useReducedMotion()

  const enter = useCallback(() => {
    if (cut) return
    setCut(true)
    setTimeout(onDone, reduce ? 150 : CUT_MS + 150)
  }, [cut, onDone, reduce])

  // Enter / пробел — войти, Esc — пропустить без анимации
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone()
      else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        enter()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enter, onDone])

  // Удар мечом: тянешь мышью или пальцем через экран — за курсором остаётся след туши
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (cut || (e.target as HTMLElement).closest('button')) return
    drag.current = { x: e.clientX, y: e.clientY }
    setStroke({ x1: e.clientX, y1: e.clientY, x2: e.clientX, y2: e.clientY })
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    setStroke({ x1: drag.current.x, y1: drag.current.y, x2: e.clientX, y2: e.clientY })
  }
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    const dx = Math.abs(e.clientX - drag.current.x)
    drag.current = null
    if (dx > window.innerWidth * SLASH_MIN_SHARE) enter()
    else setStroke(null)
  }

  // Индикатор пробуждения: заранее не знаем, сколько ждать, поэтому мазок
  // асимптотически тянется к 90% и дописывается, когда сервер ответил
  const progress = status === 'ready' ? 100 : Math.round(90 * (1 - Math.exp(-elapsed / 18)))

  return (
    <div
      className={`intro ${cut ? 'intro--cut' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Vagabond Tracker"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        drag.current = null
        setStroke(null)
      }}
    >
      {/* Разрез по диагонали: от 62% высоты слева до 38% справа */}
      {cut ? (
        <>
          <Sheet side="a" />
          <Sheet side="b" />
        </>
      ) : (
        <Sheet side="whole" />
      )}

      {/* Лезвие: яркая полоса по линии разреза */}
      {cut && !reduce && (
        <motion.svg
          className="intro__blade"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <motion.line
            x1="0"
            y1="62"
            x2="100"
            y2="38"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.18, ease: 'easeIn' }}
          />
        </motion.svg>
      )}

      {stroke && !cut && (
        <svg className="intro__trail" aria-hidden="true">
          <line x1={stroke.x1} y1={stroke.y1} x2={stroke.x2} y2={stroke.y2} />
        </svg>
      )}

      <motion.div
        className="intro__ui"
        initial={{ opacity: 0 }}
        animate={{ opacity: cut ? 0 : 1 }}
        transition={{ duration: cut ? 0.15 : 0.6, delay: cut || reduce ? 0 : 1.6 }}
      >
        <p className="intro__title">
          Vagabond
          <span className="intro__sub">アニメ追跡</span>
        </p>

        <div className="intro__wake" role="status" aria-live="polite">
          <span className="intro__wake-track" aria-hidden="true">
            <span className="intro__wake-ink" style={{ width: `${progress}%` }} />
          </span>
          <span className="intro__wake-text">
            {status === 'ready'
              ? t('The server is awake.')
              : status === 'unreachable'
                ? t('The server isn’t answering. You can still go in and try again inside.')
                : t('Waking the server, {s} s. Free hosting sleeps when idle, so this can take up to a minute.', { s: elapsed })}
          </span>
        </div>

        <button type="button" className="intro__enter" onClick={enter}>
          <span className="intro__blade-mark" aria-hidden="true" />
          {t('Enter')}
        </button>
        <p className="intro__hint">{t('Drag across the screen to cut through, or press Enter. Esc skips.')}</p>
      </motion.div>
    </div>
  )
}
